import { NextResponse } from 'next/server';
import { verifyWechatSignature, getMPUserInfo, getMPOAuthUrl } from '@/lib/wechat-mp';
import { XMLParser } from 'fast-xml-parser';
import { dbQuery } from '@/lib/db';
import { findUserByWechatOpenId, findUserByWechatUnionId, createUser, linkWechatMPIdentity, DbUser } from '@/lib/auth/users';

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
        await logDebug('auth_error', 'Invalid signature', { signature, timestamp, nonce });
        return new Response('Invalid signature', { status: 403 });
    }

    try {
        const start = Date.now();
        const xml = await request.text();

        // 1. 快速检查是否是加密模式
        if (xml.includes('<Encrypt>')) {
            await logDebug('wechat_callback', 'RECEIVED ENCRYPTED MESSAGE (Safe Mode)', { rawXml: xml });
            return new Response('success');
        }

        const result = parser.parse(xml);
        const msg = result.xml;

        if (!msg) {
            await logDebug('wechat_callback', 'Empty or invalid XML', { rawXml: xml });
            return new Response('success');
        }

        await logDebug('wechat_callback', `Received ${msg.Event || msg.MsgType}`, {
            from: msg.FromUserName,
            to: msg.ToUserName,
            event: msg.Event,
            eventKey: msg.EventKey
        });

        // MsgType: event, Event: subscribe 或 SCAN
        if (msg.MsgType === 'event' && (msg.Event === 'subscribe' || msg.Event === 'SCAN')) {
            const openid = msg.FromUserName;
            let sceneId = msg.EventKey;
            if (msg.Event === 'subscribe' && typeof sceneId === 'string' && sceneId.startsWith('qrscene_')) {
                sceneId = sceneId.replace('qrscene_', '');
            }

            if (!sceneId) {
                return new Response('success');
            }

            // 2. 极简用户处理：只查找或创建基础记录，不调微信获取昵称接口 (避免超时)
            let user = await findUserByWechatOpenId(openid) as DbUser | null;
            let unionid = user?.union_id || null;

            if (!user) {
                // 仅创建带默认名称的用户，由后续同步流程更新
                user = await createUser({
                    displayName: '微信用户',
                });
            }

            // 3. 关联身份并更新会话状态
            await Promise.all([
                linkWechatMPIdentity(user.id, openid, unionid),
                dbQuery(
                    `UPDATE wechat_qr_sessions
                     SET status = 'COMPLETED', user_id = $1
                     WHERE scene_id = $2`,
                    [user.id, sceneId]
                )
            ]);

            // 4. 返回自动回复消息 (最简格式：无换行，无链接)
            const replyXml = `<xml><ToUserName><![CDATA[${openid}]]></ToUserName><FromUserName><![CDATA[${msg.ToUserName}]]></FromUserName><CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[登录成功]]></Content></xml>`;

            await logDebug('wechat_reply', 'Sending SIMPLE XML reply', { replyXml });

            return new Response(replyXml, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8'
                }
            });
        }

        return new Response('success');
    } catch (error: any) {
        await logDebug('wechat_callback_error', error.message, { stack: error.stack });
        return new Response('success');
    }
}
