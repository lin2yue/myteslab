'use server';

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ balance: null });
    }

    try {
        const { rows } = await dbQuery<{
            balance: number;
            paid_balance: number;
            gift_balance: number;
            reserved: number;
        }>(
            `SELECT 
                c.balance,
                c.paid_balance,
                c.gift_balance,
                COALESCE((
                    SELECT SUM(credits_spent) 
                    FROM generation_tasks 
                    WHERE user_id = c.user_id 
                      AND status IN ('pending', 'processing')
                ), 0) as reserved
             FROM user_credits c
             WHERE c.user_id = $1 
             LIMIT 1`,
            [user.id]
        );

        const balance = Number(rows[0]?.balance ?? 0);
        const paidBalance = Number(rows[0]?.paid_balance ?? 0);
        const giftBalanceRaw = Number(rows[0]?.gift_balance ?? 0);
        const giftBalance = giftBalanceRaw > 0 ? giftBalanceRaw : Math.max(balance - paidBalance, 0);
        const reserved = Number(rows[0]?.reserved ?? 0);

        // 保持向后兼容：balance 仍然返回可用总余额
        return NextResponse.json({
            balance: Math.max(balance - reserved, 0),
            paid_balance: Math.max(paidBalance, 0),
            gift_balance: Math.max(giftBalance, 0),
            reserved: Math.max(reserved, 0),
        });
    } catch (error) {
        console.error('[credits/balance] error', error);
        return NextResponse.json({ balance: 0 });
    }
}
