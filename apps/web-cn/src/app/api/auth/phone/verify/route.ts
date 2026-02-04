'use server';

import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { hashOtp } from '@/lib/auth/otp';
import { createSession } from '@/lib/auth/session';
import { createUser, getUserByPhone } from '@/lib/auth/users';

function normalizePhone(input: string) {
    const trimmed = input.replace(/\s+/g, '');
    const plain = trimmed.replace(/^\+86/, '');
    if (!/^1[3-9]\d{9}$/.test(plain)) return null;
    return {
        phoneDb: `+86${plain}`,
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const normalized = normalizePhone(body?.phone || '');
        const code = String(body?.code || '').trim();

        if (!normalized || !/^\d{6}$/.test(code)) {
            return NextResponse.json({ success: false, error: '验证码错误' }, { status: 400 });
        }

        const codeHash = hashOtp(code);
        const { rows } = await dbQuery<{ id: string }>(
            `UPDATE verification_codes
             SET consumed_at = NOW()
             WHERE id = (
                 SELECT id
                 FROM verification_codes
                 WHERE phone = $1
                   AND code_hash = $2
                   AND consumed_at IS NULL
                   AND expires_at > NOW()
                 ORDER BY created_at DESC
                 LIMIT 1
             )
             RETURNING id`,
            [normalized.phoneDb, codeHash]
        );

        if (!rows[0]) {
            return NextResponse.json({ success: false, error: '验证码无效或已过期' }, { status: 400 });
        }

        let user = await getUserByPhone(normalized.phoneDb);
        if (!user) {
            const displayName = `用户${normalized.phoneDb.slice(-4)}`;
            user = await createUser({ phone: normalized.phoneDb, displayName });
        }

        if (!user) {
            return NextResponse.json({ success: false, error: '登录失败' }, { status: 500 });
        }

        await createSession(user.id);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                phone: user.phone,
                display_name: user.display_name,
            }
        });
    } catch (error) {
        console.error('[auth/phone/verify] error', error);
        return NextResponse.json({ success: false, error: '登录失败，请稍后重试' }, { status: 500 });
    }
}
