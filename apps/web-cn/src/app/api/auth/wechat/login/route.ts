'use server';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { normalizeNextPath } from '@/lib/auth/redirect';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const next = normalizeNextPath(url.searchParams.get('next'), '/');

    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!appId || !appSecret) {
        return NextResponse.redirect(new URL('/login?error=wechat_not_configured', request.url));
    }

    const state = randomBytes(16).toString('hex');
    const cookieStore = await cookies();
    cookieStore.set('wechat_oauth_state', state, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 10 * 60,
    });
    cookieStore.set('wechat_oauth_next', next, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 10 * 60,
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || url.origin;
    const redirectUri = encodeURIComponent(`${origin}/api/auth/wechat/callback`);
    const scope = 'snsapi_login';
    const wechatUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;

    return NextResponse.redirect(wechatUrl);
}
