'use server';

import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { generateOtpCode, hashOtp } from '@/lib/auth/otp';
import { OTP_TTL_MINUTES, OTP_RESEND_INTERVAL_SECONDS, OTP_MAX_PER_DAY } from '@/lib/auth/constants';
import { sendSmsCode } from '@/lib/sms/aliyun';

function normalizePhone(input: string) {
    const trimmed = input.replace(/\s+/g, '');
    const plain = trimmed.replace(/^\+86/, '');
    if (!/^1[3-9]\d{9}$/.test(plain)) return null;
    return {
        phoneDb: `+86${plain}`,
        phoneSms: plain,
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const normalized = normalizePhone(body?.phone || '');
        if (!normalized) {
            return NextResponse.json({ success: false, error: '手机号格式不正确' }, { status: 400 });
        }

        const { phoneDb, phoneSms } = normalized;

        const { rows: recentRows } = await dbQuery<{ created_at: string }>(
            `SELECT created_at
             FROM verification_codes
             WHERE phone = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [phoneDb]
        );

        if (recentRows[0]) {
            const last = new Date(recentRows[0].created_at).getTime();
            const diff = (Date.now() - last) / 1000;
            if (diff < OTP_RESEND_INTERVAL_SECONDS) {
                return NextResponse.json({
                    success: false,
                    error: `请在 ${Math.ceil(OTP_RESEND_INTERVAL_SECONDS - diff)} 秒后重试`
                }, { status: 429 });
            }
        }

        const { rows: countRows } = await dbQuery<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM verification_codes
             WHERE phone = $1
               AND created_at > NOW() - INTERVAL '1 day'`,
            [phoneDb]
        );
        const count = Number(countRows[0]?.count || 0);
        if (count >= OTP_MAX_PER_DAY) {
            return NextResponse.json({ success: false, error: '今日验证码次数已达上限' }, { status: 429 });
        }

        const code = generateOtpCode();
        const codeHash = hashOtp(code);
        const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

        const { rows } = await dbQuery<{ id: string }>(
            `INSERT INTO verification_codes (phone, code_hash, expires_at)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [phoneDb, codeHash, expiresAt]
        );

        try {
            await sendSmsCode(phoneSms, code);
        } catch (smsError) {
            if (rows[0]?.id) {
                await dbQuery('DELETE FROM verification_codes WHERE id = $1', [rows[0].id]);
            }
            throw smsError;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[auth/phone/send] error', error);
        return NextResponse.json({ success: false, error: '发送失败，请稍后重试' }, { status: 500 });
    }
}
