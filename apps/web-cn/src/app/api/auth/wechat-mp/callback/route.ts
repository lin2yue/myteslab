
import { NextResponse } from 'next/server';
import { verifyWechatSignature, getMPUserInfo } from '@/lib/wechat-mp';
import { XMLParser } from 'fast-xml-parser';
import { dbQuery } from '@/lib/db';
import { findUserByWechatOpenId, findUserByWechatUnionId, createUser, linkWechatMPIdentity } from '@/lib/auth/users';

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
        const result = parser.parse(xml);
        const msg = result.xml;

        // MsgType: event, Event: subscribe 或 SCAN
        if (msg.MsgType === 'event' && (msg.Event === 'subscribe' || msg.Event === 'SCAN')) {
            const openid = msg.FromUserName;
            let sceneId = msg.EventKey; // SCAN 事件直接是 sceneId，subscribe 是 qrscene_sceneId
            if (msg.Event === 'subscribe' && sceneId && sceneId.startsWith('qrscene_')) {
                sceneId = sceneId.replace('qrscene_', '');
            }

            if (!sceneId) return new Response('success'); // 没有场景值，普通关注

            // 1. 先通过 openid 尝试快速查找用户
            let user = await findUserByWechatOpenId(openid);
            let unionid = null; // 我们后面并行更新时会处理

            // 2. 如果没找到用户，才去调微信接口（这个最慢）
            if (!user) {
                const userInfo = await getMPUserInfo(openid);
                unionid = userInfo?.unionid || null;

                if (unionid) {
                    user = await findUserByWechatUnionId(unionid);
                }

                if (!user) {
                    // 创建新用户
                    user = await createUser({
                        displayName: userInfo?.nickname || '微信用户',
                        avatarUrl: userInfo?.headimgurl || null,
                    });
                }
            }

            // 3. 关联身份并更新会话状态
            if (user) {
                // 并行执行数据库更新
                await Promise.all([
                    linkWechatMPIdentity(user.id, openid, unionid),
                    dbQuery(
                        `UPDATE wechat_qr_sessions 
                         SET status = 'COMPLETED', user_id = $1 
                         WHERE scene_id = $2`,
                        [user.id, sceneId]
                    )
                ]);
            }
        }

        return new Response('success');
    } catch (error) {
        console.error('[wechat-mp] Callback error', error);
        return new Response('error', { status: 500 });
    }
}
