
import { createHash } from 'crypto';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

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

function sha1Signature(parts: string[]) {
    return createHash('sha1').update(parts.sort().join('')).digest('hex');
}

export function verifyWechatSignature(
    timestamp: string,
    nonce: string,
    signature: string,
    encrypted?: string
) {
    const token = process.env.WECHAT_MP_TOKEN;
    if (!token) return false;

    const hash = encrypted
        ? sha1Signature([token, timestamp, nonce, encrypted])
        : sha1Signature([token, timestamp, nonce]);

    return hash === signature;
}

function getWechatAesKeyBuffer() {
    const aesKey = (process.env.WECHAT_MP_AES_KEY || '').trim();
    if (!aesKey) {
        throw new Error('WECHAT_MP_AES_KEY is not configured');
    }
    return Buffer.from(`${aesKey}=`, 'base64');
}

function decodePKCS7(buf: Buffer): Buffer {
    const pad = buf[buf.length - 1];
    const padLen = pad < 1 || pad > 32 ? 0 : pad;
    return padLen ? buf.subarray(0, buf.length - padLen) : buf;
}

function encodePKCS7(buf: Buffer): Buffer {
    const blockSize = 32;
    const amountToPad = blockSize - (buf.length % blockSize || blockSize);
    const pad = Buffer.alloc(amountToPad, amountToPad);
    return Buffer.concat([buf, pad]);
}

export function decryptWechatMessage(encrypted: string): string {
    const key = getWechatAesKeyBuffer();
    const iv = key.subarray(0, 16);
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);

    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    const plainBuffer = decodePKCS7(decryptedBuffer);

    // WeChat packet: 16 bytes random + 4 bytes msg_len + xml + appid
    const msgLength = plainBuffer.readUInt32BE(16);
    const xmlStart = 20;
    const xmlEnd = xmlStart + msgLength;
    const xml = plainBuffer.subarray(xmlStart, xmlEnd).toString('utf8');
    const appId = plainBuffer.subarray(xmlEnd).toString('utf8');
    const expectedAppId = (process.env.WECHAT_MP_APP_ID || '').trim();
    if (expectedAppId && appId !== expectedAppId) {
        throw new Error('Wechat appid mismatch when decrypting message');
    }

    return xml;
}

export function encryptWechatMessage(plainXml: string, timestamp: string, nonce: string) {
    const token = (process.env.WECHAT_MP_TOKEN || '').trim();
    const appId = (process.env.WECHAT_MP_APP_ID || '').trim();
    if (!token || !appId) {
        throw new Error('WECHAT_MP_TOKEN or WECHAT_MP_APP_ID is not configured');
    }

    const key = getWechatAesKeyBuffer();
    const iv = key.subarray(0, 16);
    const random16 = randomBytes(16);
    const xmlBuffer = Buffer.from(plainXml, 'utf8');
    const msgLength = Buffer.alloc(4);
    msgLength.writeUInt32BE(xmlBuffer.length, 0);
    const appIdBuffer = Buffer.from(appId, 'utf8');
    const content = encodePKCS7(Buffer.concat([random16, msgLength, xmlBuffer, appIdBuffer]));

    const cipher = createCipheriv('aes-256-cbc', key, iv);
    cipher.setAutoPadding(false);
    const encrypted = Buffer.concat([cipher.update(content), cipher.final()]).toString('base64');
    const signature = sha1Signature([token, timestamp, nonce, encrypted]);

    const responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<xml>
<Encrypt><![CDATA[${encrypted}]]></Encrypt>
<MsgSignature><![CDATA[${signature}]]></MsgSignature>
<TimeStamp>${timestamp}</TimeStamp>
<Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`;

    return { encrypted, signature, responseXml };
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
        return {
            success: false,
            error: data.errmsg,
            errcode: data.errcode
        };
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
