import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail } from '@/lib/auth/users';
import { createSession } from '@/lib/auth/session';

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = await getUserByEmail(email);

        if (!user || !user.password_hash) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // 验证密码
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // 检查邮件是否已验证
        if (email.includes('@') && !user.email_verified_at) {
            return NextResponse.json({
                error: 'Email not verified',
                needsVerification: true,
                email: user.email
            }, { status: 403 });
        }

        // 创建会话
        await createSession(user.id);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('[Auth] Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
