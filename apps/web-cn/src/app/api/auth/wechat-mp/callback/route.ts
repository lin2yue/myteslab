import { NextResponse } from 'next/server';
import { verifyWechatSignature, getMPOAuthQRUrl } from '@/lib/wechat-mp'; // Import the QR OAuth helper
import { XMLParser } from 'fast-xml-parser';
import { dbQuery } from '@/lib/db';

const parser = new XMLParser();

async function logDebug(category: string, message: string, data: any = null) {
    try {
        await dbQuery(
            'INSERT INTO debug_logs (category, message, data) VALUES ($1, $2, $3)',
            [category, message, data ? JSON.stringify(data) : null]
        );
    } catch (e) {
        console.error('Failed to log debug info', e);
    }
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
    const signature = searchParams.get('signature');
    const timestamp = searchParams.get('timestamp');
    const nonce = searchParams.get('nonce');

    if (!signature || !timestamp || !nonce || !verifyWechatSignature(timestamp, nonce, signature)) {
        return new Response('Invalid signature', { status: 403 });
    }

    try {
        const xml = await request.text();

        // 1. Check for encrypted messages (just return success for now to avoid errors)
        if (xml.includes('<Encrypt>')) {
            await logDebug('wechat_callback', 'RECEIVED ENCRYPTED MESSAGE (Safe Mode)', { rawXml: xml });
            return new Response('success');
        }

        const result = parser.parse(xml);
        const msg = result.xml;

        if (!msg) {
            return new Response('success');
        }

        await logDebug('wechat_callback', `Received ${msg.Event || msg.MsgType}`, {
            from: msg.FromUserName,
            event: msg.Event,
            eventKey: msg.EventKey
        });

        // Handle 'subscribe' (new follow) and 'SCAN' (already followed)
        if (msg.MsgType === 'event' && (msg.Event === 'subscribe' || msg.Event === 'SCAN')) {
            const openid = msg.FromUserName;
            let sceneId = msg.EventKey;

            // 'subscribe' event keys start with 'qrscene_'
            if (msg.Event === 'subscribe' && typeof sceneId === 'string' && sceneId.startsWith('qrscene_')) {
                sceneId = sceneId.replace('qrscene_', '');
            }

            // Only proceed if we have a valid sceneId (which maps to a pending login session)
            if (sceneId) {
                // Generate the OAuth URL that links to our 'callback-oauth' route
                // Crucially, we pass the 'sceneId' as the 'state' param
                const oauthLoginUrl = getMPOAuthQRUrl(sceneId);

                // Construct the auto-reply message
                // Note: We do NOT complete the session here. The session completes only when they click the link.
                const replyContent = `欢迎来到 Tewan Club！\n\n<a href="${oauthLoginUrl}">👉 点击此处一键安全登录</a>\n\n(登录成功后将自动获取您的头像和昵称)`;

                const replyXml = `<?xml version="1.0" encoding="UTF-8"?>
<xml>
<ToUserName><![CDATA[${openid}]]></ToUserName>
<FromUserName><![CDATA[${msg.ToUserName}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${replyContent}]]></Content>
</xml>`;

                await logDebug('wechat_reply', 'Sending Login Link', { sceneId, openid });

                return new NextResponse(replyXml, {
                    headers: {
                        'Content-Type': 'text/xml',
                        'Cache-Control': 'no-cache'
                    }
                });
            }
        }

        return new Response('success');
    } catch (error: any) {
        await logDebug('wechat_callback_error', error.message, { stack: error.stack });
        return new Response('success');
    }
}
