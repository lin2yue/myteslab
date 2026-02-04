import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function POST(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const taskId = body?.taskId as string | undefined;
    const reason = (body?.reason as string | undefined) || 'Manual admin refund';

    if (!taskId) {
        return NextResponse.json({ success: false, error: 'Missing taskId' }, { status: 400 });
    }

    const client = await db().connect();
    try {
        await client.query('BEGIN');

        const { rows: taskRows } = await client.query(
            `SELECT id, user_id, credits_spent, status
             FROM generation_tasks
             WHERE id = $1
             FOR UPDATE`,
            [taskId]
        );

        if (!taskRows[0]) {
            await client.query('ROLLBACK');
            return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
        }

        const task = taskRows[0];
        if (task.status === 'failed_refunded') {
            await client.query('COMMIT');
            return NextResponse.json({ success: true, alreadyRefunded: true });
        }

        const credits = Number(task.credits_spent || 0);
        const userId = task.user_id as string;

        const { rows: creditRows } = await client.query(
            `SELECT balance, total_spent
             FROM user_credits
             WHERE user_id = $1
             FOR UPDATE`,
            [userId]
        );

        if (creditRows.length === 0) {
            await client.query(
                `INSERT INTO user_credits (user_id, balance, total_earned, total_spent, updated_at)
                 VALUES ($1, $2, $2, 0, NOW())`,
                [userId, credits]
            );
        } else {
            await client.query(
                `UPDATE user_credits
                 SET balance = balance + $2,
                     total_spent = GREATEST(total_spent - $2, 0),
                     updated_at = NOW()
                 WHERE user_id = $1`,
                [userId, credits]
            );
        }

        await client.query(
            `INSERT INTO credit_ledger (user_id, task_id, amount, type, description, created_at)
             VALUES ($1, $2, $3, 'refund', $4, NOW())`,
            [userId, taskId, credits, reason]
        );

        await client.query(
            `UPDATE generation_tasks
             SET status = 'failed_refunded',
                 steps = COALESCE(steps, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('step','refunded','ts', NOW(), 'reason', $2)),
                 error_message = COALESCE(error_message, $2),
                 updated_at = NOW()
             WHERE id = $1`,
            [taskId, reason]
        );

        await client.query('COMMIT');
        return NextResponse.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[admin refund] error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    } finally {
        client.release();
    }
}

