import { NextResponse } from 'next/server';
import { verifyWechatSignature, getMPOAuthQRUrl } from '@/lib/wechat-mp';
import { XMLParser } from 'fast-xml-parser';
import { dbQuery } from '@/lib/db';
import { findUserByWechatOpenId } from '@/lib/auth/users';
import { generateAIChatReply } from '@/lib/ai/gemini-chat';

const parser = new XMLParser();

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
            return new Response('success');
        }

        const result = parser.parse(xml);
        const msg = result.xml;

        if (!msg) {
            return new Response('success');
        }

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
<FromUserName><![CDATA[${msg.ToUserName}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${replyContent}]]></Content>
</xml>`;
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
<FromUserName><![CDATA[${msg.ToUserName}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${replyContent}]]></Content>
</xml>`;

                    return new NextResponse(replyXml, {
                        headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
                    });
                }
            }
        }

        // Handle text messages
        if (msg.MsgType === 'text') {
            const openid = msg.FromUserName;
            const content = msg.Content;

            const aiReply = await generateAIChatReply(content);

            const replyXml = `<?xml version="1.0" encoding="UTF-8"?>
<xml>
<ToUserName><![CDATA[${openid}]]></ToUserName>
<FromUserName><![CDATA[${msg.ToUserName}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${aiReply}]]></Content>
</xml>`;

            return new NextResponse(replyXml, {
                headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-cache' }
            });
        }

        return new Response('success');
    } catch (error: any) {
        console.error('[wechat-callback] Error processing message:', error);
        return new Response('success');
    }
}
