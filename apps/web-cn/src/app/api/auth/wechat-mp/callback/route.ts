import { NextResponse } from 'next/server';
import { verifyWechatSignature, getMPOAuthQRUrl, decryptWechatMessage, encryptWechatMessage, sendMPCustomMessage } from '@/lib/wechat-mp';
import { XMLParser } from 'fast-xml-parser';
import { dbQuery } from '@/lib/db';
import { findUserByWechatOpenId } from '@/lib/auth/users';
import { generateAIChatReply } from '@/lib/ai/gemini-chat';
import { createHash } from 'crypto';

const parser = new XMLParser();
let dedupTableEnsured = false;
const WECHAT_TEXT_MAX_BYTES = 1800;
const WECHAT_ASYNC_MAX_SEGMENTS = 4;
const WECHAT_ASYNC_TRUNCATE_HINT = '消息较长，微信单次下发条数有限。如需剩余内容，请再发一条消息，我继续回复。';
const WECHAT_ASYNC_QUOTA_FALLBACK = '当前会话消息通道已达上限，请再发送一条消息，我继续回复你。';

type WechatInboundMessage = {
    FromUserName?: string;
    ToUserName?: string;
    MsgType?: string;
    MsgId?: string | number;
    Content?: string;
    Event?: string;
    EventKey?: string;
    CreateTime?: string | number;
};

type WechatEnvelope = {
    xml?: {
        Encrypt?: string;
    };
};

function utf8ByteLength(text: string) {
    return Buffer.byteLength(text || '', 'utf8');
}

function splitTextByUtf8Bytes(text: string, maxBytes: number): string[] {
    const input = String(text || '').trim();
    if (!input) return [];

    const segments: string[] = [];
    let current = '';

    for (const ch of input) {
        const candidate = current + ch;
        if (utf8ByteLength(candidate) <= maxBytes) {
            current = candidate;
            continue;
        }

        if (current.trim()) {
            segments.push(current.trim());
        }
        current = ch;
    }

    if (current.trim()) {
        segments.push(current.trim());
    }

    return segments;
}

function fitTextWithinUtf8Bytes(text: string, maxBytes: number): string {
    let out = '';
    for (const ch of String(text || '')) {
        const candidate = out + ch;
        if (utf8ByteLength(candidate) > maxBytes) break;
        out = candidate;
    }
    return out.trim();
}

function appendHintWithinBytes(base: string, hint: string, maxBytes: number): string {
    const trimmedBase = String(base || '').trim();
    const trimmedHint = String(hint || '').trim();
    if (!trimmedHint) return fitTextWithinUtf8Bytes(trimmedBase, maxBytes);

    const merged = trimmedBase ? `${trimmedBase}\n\n${trimmedHint}` : trimmedHint;
    if (utf8ByteLength(merged) <= maxBytes) {
        return merged;
    }
    if (utf8ByteLength(trimmedHint) <= maxBytes) {
        return trimmedHint;
    }
    return fitTextWithinUtf8Bytes(trimmedHint, maxBytes);
}

function buildAsyncCustomerSegments(content: string): string[] {
    const segments = splitTextByUtf8Bytes(content, WECHAT_TEXT_MAX_BYTES);
    if (segments.length <= WECHAT_ASYNC_MAX_SEGMENTS) {
        return segments;
    }

    const capped = segments.slice(0, WECHAT_ASYNC_MAX_SEGMENTS);
    const lastIndex = capped.length - 1;
    capped[lastIndex] = appendHintWithinBytes(capped[lastIndex], WECHAT_ASYNC_TRUNCATE_HINT, WECHAT_TEXT_MAX_BYTES);
    return capped;
}

function sanitizeXmlCDataContent(content: string) {
    return String(content || '').replace(/]]>/g, ']]]]><![CDATA[>');
}

function normalizeText(text: string) {
    return (text || '').trim().toLowerCase();
}

function isWrapInstallIntent(text: string) {
    const t = normalizeText(text);
    if (!t) return false;
    const wrapKeyword = /(车膜|贴膜|车贴|车衣|贴纸|涂装|拉花|wrap|wraps)/i;
    const installKeyword = /(怎么|如何|安装|导入|上车|用到车上|放到车上|怎么用)/i;
    return wrapKeyword.test(t) && installKeyword.test(t);
}

function isLockSoundInstallIntent(text: string) {
    const t = normalizeText(text);
    if (!t) return false;
    const soundKeyword = /(锁车音|个性喇叭|boombox|提示音|喇叭音)/i;
    const installKeyword = /(怎么|如何|安装|导入|设置|上车|使用|启用)/i;
    return soundKeyword.test(t) && installKeyword.test(t);
}

function isCreditsIntent(text: string) {
    const t = normalizeText(text);
    if (!t) return false;
    return /(积分|点数|怎么扣|扣费|收费|价格|多少钱|10积分)/i.test(t);
}

function isDownloadFailureIntent(text: string) {
    const t = normalizeText(text);
    if (!t) return false;
    return /(下载不了|下载失败|下载不动|导不进去|看不到文件|无法导入|无法下载)/i.test(t);
}

function isAiGenerationIntent(text: string) {
    const t = normalizeText(text);
    if (!t) return false;
    return /(ai|生成|提示词|prompt|怎么生成|不会用)/i.test(t);
}

function buildFastReplyByIntent(text: string): string | null {
    if (isWrapInstallIntent(text)) {
        return [
            '车膜安装到车机可按这 4 步：',
            '1) 把 tewan 下载的贴膜 PNG 放进 U 盘根目录的 Wraps 文件夹（没有就新建，注意大小写）。',
            '2) U 盘建议 exFAT，单张图片建议不超过 1MB。',
            '3) 插入车辆后，在车机打开：玩具箱 > 喷漆车间 > 贴膜（Wraps）。',
            '4) 选择对应贴膜并应用；若看不到文件，优先检查 PNG 格式、Wraps 文件夹名和 U 盘格式。'
        ].join('\n');
    }
    if (isLockSoundInstallIntent(text)) {
        return [
            '锁车音设置可按这 5 步：',
            '1) 基础锁车提示音：触摸屏左下角汽车图标 > 车锁 > 锁定提示音（开启）。',
            '2) 若车辆版本为 2023.44.30.8 及以上：可在 应用程序 > 玩具箱 > 个性喇叭 > 锁定声音 选择小丑喇叭、掌声等。',
            '3) 使用自定义声音：文件命名为 LockChime.wav（<1MB），放入 USB 闪存盘并插到支持数据传输的 U 口，再在上述路径设置。',
            '4) 使用自定义锁车音后，车锁页面的“锁定提示音”会自动关闭；这是正常现象。',
            '5) 恢复默认：先在“个性喇叭”关闭锁车提示音，再回到“车锁”重新开启“锁定提示音”。部分车型 U 口可能在手套箱或中央扶手箱。'
        ].join('\n');
    }
    if (isCreditsIntent(text)) {
        return [
            '当前规则如下：',
            '1) AI 贴膜生成：每次点击“立即生成”消耗 10 积分。',
            '2) 锁车音下载：免费，不消耗积分。',
            '3) 3D 预览与调色：免费。',
            '如果你要，我可以按你的车型给你推荐最省积分的生成方式。'
        ].join('\n');
    }
    if (isDownloadFailureIntent(text)) {
        return [
            '下载/导入失败可以按这个顺序排查：',
            '1) 车膜必须是 PNG，且放在 U 盘根目录 Wraps 文件夹。',
            '2) U 盘优先 exFAT，文件夹名必须是 Wraps（大小写一致）。',
            '3) 车机里走：玩具箱 > 喷漆车间 > 贴膜（Wraps）重新读取。',
            '4) 还不行就换一个 U 盘再试（部分 U 盘兼容性较差）。'
        ].join('\n');
    }
    if (isAiGenerationIntent(text)) {
        return [
            'AI 贴膜快速上手：',
            '1) 先选车型（Model 3 / Y / Cybertruck）。',
            '2) 输入提示词：风格 + 颜色 + 材质 + 元素（例：哑光黑底，红色赛道线，碳纤维纹理）。',
            '3) 点击生成后先看 3D 预览，不满意就补充更具体细节再生成。',
            '4) 满意后下载 PNG，可直接按 Wraps 目录导入车机。'
        ].join('\n');
    }
    return null;
}

function sanitizeOutgoingReply(userText: string, reply: string): string {
    const raw = String(reply || '').trim();
    if (!raw) {
        return buildFastReplyByIntent(userText) || '我可以直接给你步骤。你可以问我：车膜安装、锁车音安装、积分规则。';
    }

    const blocked = /(再发(?:我)?一次|稍后再发|晚点再发|重新发一遍|再问一次)/i;
    if (blocked.test(raw)) {
        return buildFastReplyByIntent(userText) || '我可以直接给你步骤。你可以问我：车膜安装、锁车音安装、积分规则。';
    }

    // Remove repetitive greetings for follow-up troubleshooting style chats.
    const noGreeting = raw.replace(/^(你好[！!，,\s]*|您好[！!，,\s]*|hi[！!，,\s]*|hello[！!，,\s]*)+/i, '').trim();
    return noGreeting || raw;
}

function buildMessageKey(msg: WechatInboundMessage): string {
    const from = msg?.FromUserName || '';
    const msgType = msg?.MsgType || '';
    const msgId = msg?.MsgId;
    if (msgId) return `${from}:${msgId}`;
    const content = msgType === 'text' ? (msg?.Content || '') : (msg?.EventKey || msg?.Event || '');
    return `${from}:${msgType}:${msg?.CreateTime || ''}:${content}`;
}

function hashText(input: string) {
    return createHash('sha1').update(input || '').digest('hex');
}

async function ensureGlobalDedupTable() {
    if (dedupTableEnsured) return;
    await dbQuery(`
        CREATE TABLE IF NOT EXISTS wechat_message_dedup (
            dedup_key TEXT PRIMARY KEY,
            openid TEXT NOT NULL,
            msg_type TEXT NOT NULL,
            msg_id TEXT NULL,
            status TEXT NOT NULL DEFAULT 'processing',
            reply_text TEXT NULL,
            content_hash TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_wechat_message_dedup_last_seen ON wechat_message_dedup(last_seen_at)`);
    dedupTableEnsured = true;
}

async function tryClaimMessage(params: {
    dedupKey: string;
    openid: string;
    msgType: string;
    msgId?: string | null;
    contentHash?: string | null;
}) {
    await ensureGlobalDedupTable();
    const { dedupKey, openid, msgType, msgId, contentHash } = params;
    const insertRes = await dbQuery(
        `INSERT INTO wechat_message_dedup (dedup_key, openid, msg_type, msg_id, content_hash)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (dedup_key) DO NOTHING`,
        [dedupKey, openid, msgType, msgId || null, contentHash || null]
    );
    if (insertRes.rowCount && insertRes.rowCount > 0) {
        return { isNew: true as const, replyText: null as string | null };
    }

    const { rows } = await dbQuery<{ reply_text: string | null }>(
        `SELECT reply_text FROM wechat_message_dedup WHERE dedup_key = $1 LIMIT 1`,
        [dedupKey]
    );
    await dbQuery(`UPDATE wechat_message_dedup SET last_seen_at = NOW() WHERE dedup_key = $1`, [dedupKey]);
    return { isNew: false as const, replyText: rows[0]?.reply_text || null };
}

async function saveReplyForDedup(dedupKey: string, replyText: string, status: 'passive_replied' | 'async_sent') {
    await ensureGlobalDedupTable();
    await dbQuery(
        `UPDATE wechat_message_dedup
         SET reply_text = $2, status = $3, last_seen_at = NOW()
         WHERE dedup_key = $1`,
        [dedupKey, replyText, status]
    );
}

async function sendAsyncCustomerMessage(params: {
    openid: string;
    content: string;
    dedupKey: string;
    saveQuotaFallback?: boolean;
}) {
    const { openid, content, dedupKey, saveQuotaFallback = false } = params;
    try {
        const segments = buildAsyncCustomerSegments(content);
        if (segments.length === 0) return;

        for (const segment of segments) {
            const result = await sendMPCustomMessage(openid, segment);
            if (!result?.success) {
                const errcode = typeof result?.errcode === 'number' ? result.errcode : null;
                if (errcode === 45047 && saveQuotaFallback) {
                    await saveReplyForDedup(dedupKey, WECHAT_ASYNC_QUOTA_FALLBACK, 'async_sent');
                }
                console.error('[wechat-callback] async customer message failed', result);
                return;
            }
        }

        // Dedup only needs the first segment for retries.
        await saveReplyForDedup(dedupKey, segments[0], 'async_sent');
    } catch (error) {
        console.error('[wechat-callback] async customer message error', error);
    }
}

function buildTextReplyXml(openid: string, toUserName: string, content: string) {
    const safeContent = sanitizeXmlCDataContent(content);
    return `<?xml version="1.0" encoding="UTF-8"?>
<xml>
<ToUserName><![CDATA[${openid}]]></ToUserName>
<FromUserName><![CDATA[${toUserName}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${safeContent}]]></Content>
</xml>`;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const signature = searchParams.get('signature');
    const timestamp = searchParams.get('timestamp');
    const nonce = searchParams.get('nonce');
    const echostr = searchParams.get('echostr');

    if (!signature || !timestamp || !nonce || !echostr) {
        return new Response('Invalid request', { status: 400 });
    }

    if (verifyWechatSignature(timestamp, nonce, signature)) {
        return new Response(echostr);
    }

    return new Response('Signature verification failed', { status: 403 });
}

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const signature = searchParams.get('msg_signature') || searchParams.get('signature');
    const timestamp = searchParams.get('timestamp');
    const nonce = searchParams.get('nonce');

    try {
        if (!signature || !timestamp || !nonce) {
            return new Response('Invalid signature', { status: 403 });
        }

        const xml = await request.text();
        let inboundEncrypted = false;
        let parsedEnvelope: WechatEnvelope | null = null;
        let payloadXml = xml;

        if (xml.includes('<Encrypt>')) {
            parsedEnvelope = parser.parse(xml) as WechatEnvelope;
            const encrypted = parsedEnvelope?.xml?.Encrypt;
            if (!encrypted || !verifyWechatSignature(timestamp, nonce, signature, encrypted)) {
                return new Response('Invalid signature', { status: 403 });
            }
            payloadXml = decryptWechatMessage(encrypted);
            inboundEncrypted = true;
        } else if (!verifyWechatSignature(timestamp, nonce, signature)) {
            return new Response('Invalid signature', { status: 403 });
        }

        const result = parser.parse(payloadXml) as { xml?: WechatInboundMessage };
        const msg = result.xml;

        if (!msg) {
            return new Response('success');
        }

        const openid = msg.FromUserName || '';
        const toUserName = msg.ToUserName || '';
        if (!openid || !toUserName) {
            return new Response('success');
        }

        // Handle 'subscribe' (new follow) and 'SCAN' (already followed)
        if (msg.MsgType === 'event' && (msg.Event === 'subscribe' || msg.Event === 'SCAN')) {
            let sceneId = msg.EventKey;

            // 'subscribe' event keys start with 'qrscene_'
            if (msg.Event === 'subscribe' && typeof sceneId === 'string' && sceneId.startsWith('qrscene_')) {
                sceneId = sceneId.replace('qrscene_', '');
            }

            // Only proceed if we have a valid sceneId (which maps to a pending login session)
            if (sceneId) {
                // 1. Check if user already exists
                const existingUser = await findUserByWechatOpenId(openid);

                if (existingUser) {
                    // --- Scenario A: Existing User (Auto Login) ---
                    await dbQuery(
                        `UPDATE wechat_qr_sessions 
                         SET status = 'COMPLETED', user_id = $1 
                         WHERE scene_id = $2`,
                        [existingUser.id, sceneId]
                    );

                    const replyContent = `欢迎回来，${existingUser.display_name || '旧友'}！\n\n✅ 网页端已自动登录`;

                    const replyXml = `<?xml version="1.0" encoding="UTF-8"?>
<xml>
<ToUserName><![CDATA[${openid}]]></ToUserName>
<FromUserName><![CDATA[${toUserName}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${replyContent}]]></Content>
</xml>`;
                    if (inboundEncrypted) {
                        const encryptedReply = encryptWechatMessage(replyXml, timestamp, nonce);
                        return new NextResponse(encryptedReply.responseXml, {
                            headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
                        });
                    }
                    return new NextResponse(replyXml, {
                        headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
                    });

                } else {
                    // --- Scenario B: New User (Requires Registration/OAuth) ---
                    // Generate the OAuth URL that links to our 'callback-oauth' route
                    const oauthLoginUrl = getMPOAuthQRUrl(sceneId);

                    const replyContent = `欢迎来到 Tewan Club！\n\n为了给您提供更好的服务（同步头像昵称），请点击下方链接完成注册：\n\n<a href="${oauthLoginUrl}">👉 点击此处一键安全登录</a>`;

                    const replyXml = `<?xml version="1.0" encoding="UTF-8"?>
<xml>
<ToUserName><![CDATA[${openid}]]></ToUserName>
<FromUserName><![CDATA[${toUserName}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${replyContent}]]></Content>
</xml>`;

                    if (inboundEncrypted) {
                        const encryptedReply = encryptWechatMessage(replyXml, timestamp, nonce);
                        return new NextResponse(encryptedReply.responseXml, {
                            headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
                        });
                    }
                    return new NextResponse(replyXml, {
                        headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
                    });
                }
            }
        }

        // Handle text messages
        if (msg.MsgType === 'text') {
            const content = String(msg.Content || '').trim();
            const messageKey = buildMessageKey(msg);
            const dedup = await tryClaimMessage({
                dedupKey: messageKey,
                openid,
                msgType: 'text',
                msgId: msg.MsgId ? String(msg.MsgId) : null,
                contentHash: hashText(content)
            });
            if (!dedup.isNew) {
                if (!dedup.replyText) {
                    return new Response('success');
                }
                const cachedXml = buildTextReplyXml(openid, toUserName, dedup.replyText);
                if (inboundEncrypted) {
                    const encryptedReply = encryptWechatMessage(cachedXml, timestamp, nonce);
                    return new NextResponse(encryptedReply.responseXml, {
                        headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
                    });
                }
                return new NextResponse(cachedXml, {
                    headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
                });
            }

            // Deterministic FAQ first: for high-frequency questions, avoid model latency entirely.
            const fastReply = buildFastReplyByIntent(content);
            if (fastReply) {
                const safeFastReply = sanitizeOutgoingReply(content, fastReply);
                const segments = splitTextByUtf8Bytes(safeFastReply, WECHAT_TEXT_MAX_BYTES);
                const passiveReply = segments[0] || '我可以直接给你步骤。你可以问我：车膜安装、锁车音安装、积分规则。';
                await saveReplyForDedup(messageKey, passiveReply, 'passive_replied');
                if (segments.length > 1) {
                    void sendAsyncCustomerMessage({
                        openid,
                        content: segments.slice(1).join('\n\n'),
                        dedupKey: messageKey
                    });
                }
                const fastXml = buildTextReplyXml(openid, toUserName, passiveReply);
                if (inboundEncrypted) {
                    const encryptedReply = encryptWechatMessage(fastXml, timestamp, nonce);
                    return new NextResponse(encryptedReply.responseXml, {
                        headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
                    });
                }
                return new NextResponse(fastXml, {
                    headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
                });
            }

            const timeoutMs = 4500;
            const TIMEOUT = '__TIMEOUT__';
            const aiTask = generateAIChatReply(content)
                .then((txt) => sanitizeOutgoingReply(content, txt));
            const raced = await Promise.race<string | typeof TIMEOUT>([
                aiTask,
                new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), timeoutMs))
            ]);

            if (raced === TIMEOUT) {
                void aiTask
                    .then(async (finalReply) => {
                        await sendAsyncCustomerMessage({
                            openid,
                            content: finalReply,
                            dedupKey: messageKey,
                            saveQuotaFallback: true
                        });
                    })
                    .catch(async () => {
                        const fallback = sanitizeOutgoingReply(
                            content,
                            buildFastReplyByIntent(content)
                            || '我先给你直接步骤：你可以问我“车膜安装到车上”“锁车音安装”“积分怎么扣费”，我会直接按步骤回复。'
                        );
                        await sendAsyncCustomerMessage({
                            openid,
                            content: fallback,
                            dedupKey: messageKey,
                            saveQuotaFallback: true
                        });
                    });
                return new Response('success');
            }

            const safeAiReply = raced;
            const segments = splitTextByUtf8Bytes(safeAiReply, WECHAT_TEXT_MAX_BYTES);
            const passiveReply = segments[0] || '我可以直接给你步骤。你可以问我：车膜安装、锁车音安装、积分规则。';
            await saveReplyForDedup(messageKey, passiveReply, 'passive_replied');
            if (segments.length > 1) {
                void sendAsyncCustomerMessage({
                    openid,
                    content: segments.slice(1).join('\n\n'),
                    dedupKey: messageKey
                });
            }
            const replyXml = buildTextReplyXml(openid, toUserName, passiveReply);

            if (inboundEncrypted) {
                const encryptedReply = encryptWechatMessage(replyXml, timestamp, nonce);
                return new NextResponse(encryptedReply.responseXml, {
                    headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
                });
            }
            return new NextResponse(replyXml, {
                headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
            });
        }

        return new Response('success');
    } catch (error: unknown) {
        console.error('[wechat-callback] Error processing message:', error);
        return new Response('success');
    }
}
