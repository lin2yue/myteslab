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
        const { rows } = await dbQuery<{ balance: number }>(
            'SELECT balance FROM user_credits WHERE user_id = $1 LIMIT 1',
            [user.id]
        );
        return NextResponse.json({ balance: rows[0]?.balance ?? 0 });
    } catch (error) {
        console.error('[credits/balance] error', error);
        return NextResponse.json({ balance: 0 });
    }
}
