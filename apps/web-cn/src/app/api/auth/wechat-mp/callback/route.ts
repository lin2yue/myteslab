import { NextResponse } from 'next/server';
import { verifyWechatSignature, getMPUserInfo, getMPOAuthUrl } from '@/lib/wechat-mp';
import { XMLParser } from 'fast-xml-parser';
import { dbQuery } from '@/lib/db';
import { findUserByWechatOpenId, findUserByWechatUnionId, createUser, linkWechatMPIdentity, DbUser } from '@/lib/auth/users';

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
        const start = Date.now();
        const xml = await request.text();

        // 1. 快速检查是否是加密模式
        if (xml.includes('<Encrypt>')) {
            console.error('[wechat-mp] RECEIVED ENCRYPTED MESSAGE. This server does not support Safe Mode yet.');
            return new Response('success');
        }

        const result = parser.parse(xml);
        const msg = result.xml;

        if (!msg) {
            console.error('[wechat-mp] Empty or invalid XML', xml);
            return new Response('success');
        }

        console.log(`[wechat-mp] Received ${msg.Event || msg.MsgType} from ${msg.FromUserName} to ${msg.ToUserName}`);

        // MsgType: event, Event: subscribe 或 SCAN
        if (msg.MsgType === 'event' && (msg.Event === 'subscribe' || msg.Event === 'SCAN')) {
            const openid = msg.FromUserName;
            let sceneId = msg.EventKey;
            if (msg.Event === 'subscribe' && typeof sceneId === 'string' && sceneId.startsWith('qrscene_')) {
                sceneId = sceneId.replace('qrscene_', '');
            }

            if (!sceneId) {
                console.log('[wechat-mp] No sceneId, normal subscribe');
                return new Response('success');
            }

            console.log(`[wechat-mp] Processing scene: ${sceneId}`);

            // 2. 极简用户处理：只查找或创建基础记录，不调微信获取昵称接口 (避免超时)
            let user = await findUserByWechatOpenId(openid) as DbUser | null;
            let unionid = user?.union_id || null;

            if (!user) {
                // 仅创建带默认名称的用户，由后续同步流程更新
                user = await createUser({
                    displayName: '微信用户',
                });
                console.log(`[wechat-mp] Created shell user: ${user.id}`);
            }

            // 3. 关联身份并更新会话状态
            const dbOpsStart = Date.now();
            await Promise.all([
                linkWechatMPIdentity(user.id, openid, unionid),
                dbQuery(
                    `UPDATE wechat_qr_sessions 
                     SET status = 'COMPLETED', user_id = $1 
                     WHERE scene_id = $2`,
                    [user.id, sceneId]
                )
            ]);
            console.log(`[wechat-mp] DB updates took ${Date.now() - dbOpsStart}ms`);

            // 4. 返回自动回复消息 (严格单行 XML 格式)
            const syncUrl = getMPOAuthUrl(`https://tewan.club/api/auth/wechat-mp/sync`, user.id);
            const replyContent = `登录成功！\n\n<a href="${syncUrl}">[点我同步昵称头像]</a>`;
            const replyXml = `<xml><ToUserName><![CDATA[${openid}]]></ToUserName><FromUserName><![CDATA[${msg.ToUserName}]]></FromUserName><CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[${replyContent}]]></Content></xml>`;

            console.log(`[wechat-mp] Callback total ${Date.now() - start}ms. Returning XML reply.`);
            return new Response(replyXml, {
                headers: {
                    'Content-Type': 'text/xml',
                    'Cache-Control': 'no-cache'
                }
            });
        }

        console.log(`[wechat-mp] Callback end (no action) total ${Date.now() - start}ms`);
        return new Response('success');
    } catch (error) {
        console.error('[wechat-mp] Callback error', error);
        return new Response('success');
    }
}
