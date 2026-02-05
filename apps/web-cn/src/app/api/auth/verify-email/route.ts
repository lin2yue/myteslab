import { NextResponse } from 'next/server';
import { verifyEmailByToken } from '@/lib/auth/users';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    try {
        const user = await verifyEmailByToken(token);

        if (!user) {
            // 可能是令牌无效或已过期 (24小时)
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tewan.club';
            return NextResponse.redirect(`${appUrl}/zh/auth/verify-error`);
        }

        // 验证成功，跳转到登录成功页或首页
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tewan.club';
        return NextResponse.redirect(`${appUrl}/zh/auth/verify-success`);

    } catch (error) {
        console.error('[Auth] Verification error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
