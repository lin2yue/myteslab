'use server';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession } from '@/lib/auth/session';
import { createUser, findUserByWechatOpenId, linkWechatIdentity } from '@/lib/auth/users';
import { normalizeNextPath } from '@/lib/auth/redirect';

type AccessTokenResponse = {
    access_token?: string;
    openid?: string;
    unionid?: string;
    errcode?: number;
    errmsg?: string;
};

type WechatUserInfo = {
    openid?: string;
    unionid?: string;
    nickname?: string;
    headimgurl?: string;
    errcode?: number;
    errmsg?: string;
};

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!code || !state || !appId || !appSecret) {
        return NextResponse.redirect(new URL('/login?error=wechat_invalid', request.url));
    }

    const cookieStore = await cookies();
    const storedState = cookieStore.get('wechat_oauth_state')?.value;
    const next = normalizeNextPath(cookieStore.get('wechat_oauth_next')?.value, '/');

    if (!storedState || storedState !== state) {
        return NextResponse.redirect(new URL('/login?error=wechat_state', request.url));
    }

    cookieStore.set('wechat_oauth_state', '', { path: '/', maxAge: 0 });
    cookieStore.set('wechat_oauth_next', '', { path: '/', maxAge: 0 });

    const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    tokenUrl.searchParams.set('appid', appId);
    tokenUrl.searchParams.set('secret', appSecret);
    tokenUrl.searchParams.set('code', code);
    tokenUrl.searchParams.set('grant_type', 'authorization_code');

    const tokenRes = await fetch(tokenUrl.toString(), { cache: 'no-store' });
    const tokenData = (await tokenRes.json()) as AccessTokenResponse;

    if (!tokenData.access_token || !tokenData.openid) {
        console.error('[wechat] access_token error', tokenData);
        return NextResponse.redirect(new URL('/login?error=wechat_token', request.url));
    }

    const infoUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
    infoUrl.searchParams.set('access_token', tokenData.access_token);
    infoUrl.searchParams.set('openid', tokenData.openid);
    infoUrl.searchParams.set('lang', 'zh_CN');

    const infoRes = await fetch(infoUrl.toString(), { cache: 'no-store' });
    const infoData = (await infoRes.json()) as WechatUserInfo;

    if (!infoData.openid) {
        console.error('[wechat] userinfo error', infoData);
        return NextResponse.redirect(new URL('/login?error=wechat_user', request.url));
    }

    let user = await findUserByWechatOpenId(infoData.openid);
    if (!user) {
        const displayName = infoData.nickname || '微信用户';
        user = await createUser({
            displayName,
            avatarUrl: infoData.headimgurl || null,
        });
        if (user) {
            await linkWechatIdentity(user.id, infoData.openid, infoData.unionid || null);
        }
    }

    if (!user) {
        return NextResponse.redirect(new URL('/login?error=wechat_user_create', request.url));
    }

    await createSession(user.id);

    return NextResponse.redirect(new URL(next, request.url));
}
