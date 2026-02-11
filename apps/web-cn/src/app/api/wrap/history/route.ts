import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db, dbQuery } from '@/lib/db';

type TaskHistoryRow = {
    id: string;
    prompt: string;
    status: string;
    error_message: string | null;
    steps: unknown;
    created_at: string;
    updated_at: string;
};

type StaleTaskRow = {
    id: string;
    status: 'pending' | 'processing';
    credits_spent: number;
};

type CreditAmountRow = { amount: number };
type ExistsRow = { exists: boolean };
type UserCreditRow = { balance: number; total_spent: number };

const STALE_TASK_MS = Number(process.env.WRAP_TASK_STALE_MS ?? 10 * 60 * 1000);

async function recoverStaleTasks(userId: string) {
    const staleSeconds = Math.max(60, Math.floor(STALE_TASK_MS / 1000));
    const { rows: staleCandidates } = await dbQuery<{ id: string }>(
        `SELECT id
         FROM generation_tasks
         WHERE user_id = $1
           AND status IN ('pending', 'processing')
           AND COALESCE(updated_at, created_at) < NOW() - ($2::int * INTERVAL '1 second')
         ORDER BY created_at ASC
         LIMIT 50`,
        [userId, staleSeconds]
    );

    if (staleCandidates.length === 0) return;

    const client = await db().connect();
    try {
        for (const candidate of staleCandidates) {
            try {
                await client.query('BEGIN');

                const { rows: taskRows } = await client.query<StaleTaskRow>(
                    `SELECT id, status, credits_spent
                     FROM generation_tasks
                     WHERE id = $1
                       AND user_id = $2
                       AND status IN ('pending', 'processing')
                     FOR UPDATE`,
                    [candidate.id, userId]
                );
                const task = taskRows[0];
                if (!task) {
                    await client.query('ROLLBACK');
                    continue;
                }

                const { rows: chargeRows } = await client.query<CreditAmountRow>(
                    `SELECT amount
                     FROM credit_ledger
                     WHERE task_id = $1
                       AND type IN ('generation', 'generation_charge')
                     ORDER BY created_at ASC
                     LIMIT 1`,
                    [task.id]
                );
                const chargedCredits = chargeRows[0]
                    ? Math.abs(Number(chargeRows[0].amount || task.credits_spent || 0))
                    : 0;

                const { rows: refundRows } = await client.query<ExistsRow>(
                    `SELECT EXISTS (
                        SELECT 1
                        FROM credit_ledger
                        WHERE task_id = $1
                          AND type = 'refund'
                    ) AS exists`,
                    [task.id]
                );
                const alreadyRefunded = Boolean(refundRows[0]?.exists);
                const shouldRefund = chargedCredits > 0 && !alreadyRefunded;

                if (shouldRefund) {
                    const { rows: creditRows } = await client.query<UserCreditRow>(
                        `SELECT balance, total_spent
                         FROM user_credits
                         WHERE user_id = $1
                         FOR UPDATE`,
                        [userId]
                    );

                    if (!creditRows[0]) {
                        await client.query(
                            `INSERT INTO user_credits (user_id, balance, total_earned, total_spent, updated_at)
                             VALUES ($1, $2, $2, 0, NOW())`,
                            [userId, chargedCredits]
                        );
                    } else {
                        await client.query(
                            `UPDATE user_credits
                             SET balance = balance + $2,
                                 total_spent = GREATEST(total_spent - $2, 0),
                                 updated_at = NOW()
                             WHERE user_id = $1`,
                            [userId, chargedCredits]
                        );
                    }

                    await client.query(
                        `INSERT INTO credit_ledger (user_id, task_id, amount, type, description, created_at)
                         VALUES ($1, $2, $3, 'refund', $4, NOW())`,
                        [userId, task.id, chargedCredits, 'Auto refund: stale generation task cleaned by history endpoint']
                    );
                }

                const nextStatus = shouldRefund ? 'failed_refunded' : 'failed';
                const stepReason = shouldRefund
                    ? 'Stale generation task auto-stopped and refunded'
                    : 'Stale generation task auto-stopped';

                await client.query(
                    `UPDATE generation_tasks
                     SET status = $2::generation_status,
                         error_message = COALESCE(error_message, $3),
                         steps = COALESCE(steps, '[]'::jsonb) || $4::jsonb,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [
                        task.id,
                        nextStatus,
                        stepReason,
                        JSON.stringify([{ step: 'stale_auto_stopped', ts: new Date().toISOString(), reason: stepReason }])
                    ]
                );

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('[wrap/history] stale task recovery failed:', error);
            }
        }
    } finally {
        client.release();
    }
}

export async function GET(request: Request) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'ai_generated';
    const limit = Math.min(Number(searchParams.get('limit') || 10), 50);

    if (category === 'ai_generated') {
        await recoverStaleTasks(user.id);
    }

    const { rows } = await dbQuery(
        `SELECT *
         FROM wraps
         WHERE user_id = $1
           AND deleted_at IS NULL
           AND category = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [user.id, category, limit]
    );

    let tasks: TaskHistoryRow[] = [];
    if (category === 'ai_generated') {
        const taskResult = await dbQuery<TaskHistoryRow>(
            `SELECT id, prompt, status, error_message, steps, created_at, updated_at
             FROM generation_tasks
             WHERE user_id = $1
               AND status IN ('pending', 'processing', 'failed', 'failed_refunded')
             ORDER BY created_at DESC
             LIMIT $2`,
            [user.id, limit]
        );
        tasks = taskResult.rows;
    }

    return NextResponse.json({ success: true, wraps: rows, tasks });
}
