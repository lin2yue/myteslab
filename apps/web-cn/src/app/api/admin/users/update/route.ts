import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function POST(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const userId = body?.userId as string | undefined;
    const role = body?.role as string | undefined;
    const balance = Number(body?.balance);

    if (!userId || !role || Number.isNaN(balance)) {
        return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const client = await db().connect();
    try {
        await client.query('BEGIN');

        await client.query('UPDATE users SET role = $2 WHERE id = $1', [userId, role]);
        await client.query('UPDATE profiles SET role = $2 WHERE id = $1', [userId, role]);

        await client.query(
            `INSERT INTO user_credits (user_id, balance, total_earned, total_spent, updated_at)
             VALUES ($1, $2, $2, 0, NOW())
             ON CONFLICT (user_id)
             DO UPDATE SET balance = EXCLUDED.balance, updated_at = NOW()`,
            [userId, balance]
        );

        await client.query('COMMIT');
        return NextResponse.json({ success: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        console.error('[admin users update] error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    } finally {
        client.release();
    }
}

