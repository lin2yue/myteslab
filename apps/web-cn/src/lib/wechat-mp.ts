
import { createHash } from 'crypto';

const ACCESS_TOKEN_CACHE_KEY = 'wechat_mp_access_token';

type AccessTokenResponse = {
    access_token: string;
    expires_in: number;
    errcode?: number;
    errmsg?: string;
};

type TicketResponse = {
    ticket: string;
    expire_seconds: number;
    url: string;
    errcode?: number;
    errmsg?: string;
};

// Simple in-memory cache for Access Token (in a real app, use Redis)
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getMPAccessToken(): Promise<string> {
    const appId = process.env.WECHAT_MP_APP_ID;
    const appSecret = process.env.WECHAT_MP_APP_SECRET;

    if (!appId || !appSecret) {
        throw new Error('WECHAT_MP_APP_ID or WECHAT_MP_APP_SECRET is not configured');
    }

    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = (await res.json()) as AccessTokenResponse;

    if (!data.access_token) {
        console.error('[wechat-mp] Failed to get access token', data);
        throw new Error(`WeChat MP Access Token Error: ${data.errmsg || 'Unknown'}`);
    }

    cachedToken = data.access_token;
    // Buffer of 5 minutes
    tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

    return cachedToken;
}

export async function createQRScene(sceneId: string, expireSeconds = 600) {
    const token = await getMPAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token=${token}`;

    const body = {
        expire_seconds: expireSeconds,
        action_name: 'QR_STR_SCENE',
        action_info: {
            scene: { scene_str: sceneId },
        },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = (await res.json()) as TicketResponse;

    if (!data.ticket) {
        console.error('[wechat-mp] Failed to create QR scene', data);
        throw new Error(`WeChat MP QR Error: ${data.errmsg || 'Unknown'}`);
    }

    return {
        ticket: data.ticket,
        url: data.url,
        qrUrl: `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(data.ticket)}`,
    };
}

export function verifyWechatSignature(timestamp: string, nonce: string, signature: string) {
    const token = process.env.WECHAT_MP_TOKEN;
    if (!token) return false;

    const list = [token, timestamp, nonce].sort();
    const str = list.join('');
    const hash = createHash('sha1').update(str).digest('hex');

    return hash === signature;
}

export async function getMPUserInfo(openid: string) {
    const token = await getMPAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/user/info?access_token=${token}&openid=${openid}&lang=zh_CN`;

    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();

    if (data.errcode) {
        console.error('[wechat-mp] Failed to get user info', data);
        return null;
    }

    return data;
}
