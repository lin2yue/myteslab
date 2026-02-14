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
        const { rows } = await dbQuery<{ balance: number; reserved: number }>(
            `SELECT 
                c.balance,
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

        const balance = rows[0]?.balance ?? 0;
        const reserved = rows[0]?.reserved ?? 0;

        // Return Available Balance = Total Balance - In-flight Reserved
        return NextResponse.json({ balance: Math.max(balance - reserved, 0) });
    } catch (error) {
        console.error('[credits/balance] error', error);
        return NextResponse.json({ balance: 0 });
    }
}
