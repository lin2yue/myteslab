import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createUser, getUserByEmail } from '@/lib/auth/users';
import { sendActivationEmail } from '@/lib/mail/service';

export async function POST(req: Request) {
    try {
        const { email, password, displayName } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        // 检查用户是否已存在
        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 400 });
        }

        // 哈希密码
        const passwordHash = await bcrypt.hash(password, 10);

        // 生成验证令牌
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // 创建用户 (状态为未验证)
        const user = await createUser({
            email,
            passwordHash,
            displayName: displayName || email.split('@')[0],
            verificationToken,
        });

        if (!user) {
            throw new Error('Failed to create user');
        }

        // 发送激活邮件
        const mailResult = await sendActivationEmail(email, verificationToken);

        if (!mailResult.success) {
            console.error('[Auth] Failed to send activation email:', mailResult.error);
            // 即使邮件失败也返回成功，可以提示用户稍后重发
        }

        return NextResponse.json({
            success: true,
            message: 'Registration successful. Please check your email to activate your account.'
        });

    } catch (error: any) {
        console.error('[Auth] Registration error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
