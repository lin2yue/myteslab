import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserByEmail, updateVerificationToken } from '@/lib/auth/users';
import { sendActivationEmail } from '@/lib/mail/service';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await getUserByEmail(email);

        if (!user) {
            // 安全起见，不透露邮箱是否存在，但也不发送邮件
            return NextResponse.json({ success: true, message: 'If the email exists, a new link has been sent.' });
        }

        if (user.email_verified_at) {
            return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
        }

        // 生成新令牌
        const newToken = crypto.randomBytes(32).toString('hex');
        await updateVerificationToken(user.id, newToken);

        // 发送邮件
        await sendActivationEmail(email, newToken);

        return NextResponse.json({ success: true, message: 'Verification email resent.' });

    } catch (error) {
        console.error('[Auth] Resend error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
