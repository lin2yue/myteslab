
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

export function getMPOAuthUrl(redirectUri: string, state: string = '', scope: 'snsapi_base' | 'snsapi_userinfo' = 'snsapi_userinfo') {
    const appId = process.env.WECHAT_MP_APP_ID;
    const encodedUri = encodeURIComponent(redirectUri);
    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${encodedUri}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;
}

/**
 * 生成直接用于扫码授权的 URL (无感关注或直接授权)
 */
export function getMPOAuthQRUrl(sceneId: string) {
    const redirectUri = `https://tewan.club/api/auth/wechat-mp/callback-oauth`;
    return getMPOAuthUrl(redirectUri, sceneId, 'snsapi_userinfo');
}

export async function getMPOAuthUserInfo(code: string) {
    const appId = process.env.WECHAT_MP_APP_ID;
    const appSecret = process.env.WECHAT_MP_APP_SECRET;

    // 1. 获取网页授权 access_token
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;
    const tokenRes = await fetch(tokenUrl, { cache: 'no-store' });
    const tokenData = await tokenRes.json();

    if (tokenData.errcode) {
        console.error('[wechat-mp] Failed to get OAuth token', tokenData);
        return null;
    }

    const { access_token, openid } = tokenData;

    // 2. 获取用户详细信息 (snsapi_userinfo)
    const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`;
    const userInfoRes = await fetch(userInfoUrl, { cache: 'no-store' });
    const userInfoData = await userInfoRes.json();

    if (userInfoData.errcode) {
        console.error('[wechat-mp] Failed to get OAuth user info', userInfoData);
        return null;
    }

    return userInfoData;
}

export async function sendMPTemplateMessage(params: {
    touser: string;
    template_id: string;
    url?: string;
    data: Record<string, { value: string; color?: string }>;
}) {
    const token = await getMPAccessToken();
    const apiUrl = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`;

    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    const data = await res.json();
    if (data.errcode) {
        console.error('[wechat-mp] Failed to send template message', data);
        return { success: false, error: data.errmsg };
    }

    return { success: true, msgid: data.msgid };
}

export async function sendMPCustomMessage(touser: string, content: string) {
    const token = await getMPAccessToken();
    const apiUrl = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${token}`;

    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            touser,
            msgtype: 'text',
            text: { content }
        }),
    });

    const data = await res.json();
    if (data.errcode) {
        console.error('[wechat-mp] Failed to send custom message', data);
        return { success: false, error: data.errmsg, errcode: data.errcode };
    }

    return { success: true };
}
