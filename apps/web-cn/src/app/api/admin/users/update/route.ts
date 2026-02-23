import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
    notifyUserAdminAdjustmentByWechat,
    type RewardWechatNotifyResult
} from '@/lib/utils/user-reward-notify';

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
    let committed = false;
    try {
        await client.query('BEGIN');
        let creditDelta = 0;

        // 1. Update roles
        await client.query('UPDATE users SET role = $2 WHERE id = $1', [userId, role]);
        await client.query('UPDATE profiles SET role = $2 WHERE id = $1', [userId, role]);

        // 2. Update credits with ledger recording
        const { rows: currentCredits } = await client.query(
            'SELECT balance FROM user_credits WHERE user_id = $1 FOR UPDATE',
            [userId]
        );

        if (currentCredits.length === 0) {
            // New user credit record
            await client.query(
                `INSERT INTO user_credits (user_id, balance, total_earned, total_spent, updated_at)
                 VALUES ($1, $2, $2, 0, NOW())`,
                [userId, balance]
            );
            if (balance !== 0) {
                creditDelta = balance;
                await client.query(
                    `INSERT INTO credit_ledger (user_id, amount, type, description, metadata)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [userId, balance, 'admin_adjustment', 'Admin initial adjustment', JSON.stringify({ admin_id: admin.id })]
                );
            }
        } else {
            const oldBalance = currentCredits[0].balance;
            if (oldBalance !== balance) {
                const diff = balance - oldBalance;
                creditDelta = diff;

                // If diff > 0, it's a gift, so we increment total_earned
                // If diff < 0, it's a reduction, we don't touch total_earned (it's cumulative)
                const earnedIncrement = diff > 0 ? diff : 0;

                await client.query(
                    `UPDATE user_credits 
                     SET balance = $2, 
                         total_earned = total_earned + $3,
                         updated_at = NOW() 
                     WHERE user_id = $1`,
                    [userId, balance, earnedIncrement]
                );

                await client.query(
                    `INSERT INTO credit_ledger (user_id, amount, type, description, metadata)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        userId,
                        diff,
                        'admin_adjustment',
                        diff > 0 ? 'Admin manual gift' : 'Admin manual reduction',
                        JSON.stringify({
                            admin_id: admin.id,
                            old_balance: oldBalance,
                            new_balance: balance
                        })
                    ]
                );
            }
        }

        await client.query('COMMIT');
        committed = true;

        let notifyResult: RewardWechatNotifyResult | null = null;
        if (creditDelta !== 0) {
            try {
                notifyResult = await notifyUserAdminAdjustmentByWechat({
                    userId,
                    deltaCredits: creditDelta
                });
            } catch (notifyErr: unknown) {
                console.error('[admin users update] notify failed:', notifyErr);
                const message = notifyErr instanceof Error ? notifyErr.message : 'Unknown notify error';
                notifyResult = {
                    attempted: true,
                    success: false,
                    reason: 'notify_exception',
                    error: message
                };
            }
        }

        return NextResponse.json({ success: true, notifyResult });
    } catch (err: unknown) {
        if (!committed) {
            await client.query('ROLLBACK');
        }
        console.error('[admin users update] error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}
