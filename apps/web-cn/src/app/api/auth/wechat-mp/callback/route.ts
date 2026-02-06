import { NextResponse } from 'next/server';
import { verifyWechatSignature, getMPUserInfo } from '@/lib/wechat-mp';
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
            let sceneId = msg.EventKey; // SCAN 事件直接是 sceneId，subscribe 是 qrscene_sceneId
            if (msg.Event === 'subscribe' && typeof sceneId === 'string' && sceneId.startsWith('qrscene_')) {
                sceneId = sceneId.replace('qrscene_', '');
            }

            if (!sceneId) {
                console.log('[wechat-mp] No sceneId, normal subscribe');
                return new Response('success');
            }

            console.log(`[wechat-mp] Processing scene: ${sceneId}`);

            // 1. 先通过 openid 尝试快速查找用户
            let user = await findUserByWechatOpenId(openid) as DbUser | null;
            let unionid = user?.union_id || null;

            console.log(`[wechat-mp] User found in DB: ${user ? user.id : 'NO'}, name: ${user?.display_name}`);

            // 2. 如果没找到用户，或者用户名还是默认的，才去调微信接口
            const needsUpdate = !user || user.display_name === '微信用户' || !user.display_name;
            if (needsUpdate) {
                const userInfoStart = Date.now();
                const userInfo = await getMPUserInfo(openid);
                console.log(`[wechat-mp] getMPUserInfo result:`, JSON.stringify(userInfo));

                if (userInfo) {
                    unionid = userInfo.unionid || unionid;
                    const nickname = userInfo.nickname;
                    const avatar = userInfo.headimgurl;

                    if (!user && unionid) {
                        user = await findUserByWechatUnionId(unionid);
                        console.log(`[wechat-mp] User found by UnionID: ${user ? user.id : 'NO'}`);
                    }

                    if (!user) {
                        // 创建新用户
                        user = await createUser({
                            displayName: nickname || '微信用户',
                            avatarUrl: avatar || null,
                        });
                        console.log(`[wechat-mp] Created new user: ${user.id} with name ${nickname}`);
                    } else if (nickname && (user.display_name === '微信用户' || !user.display_name)) {
                        // 更新已有用户的昵称和头像
                        await dbQuery(
                            `UPDATE users SET display_name = $1, avatar_url = $2 WHERE id = $3`,
                            [nickname, avatar || user.avatar_url, user.id]
                        );
                        console.log(`[wechat-mp] Updated user ${user.id} name to ${nickname}`);
                    }
                } else {
                    console.log(`[wechat-mp] Could not get userInfo, using fallback`);
                    if (!user) {
                        user = await createUser({ displayName: '微信用户' });
                    }
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

                // 4. 返回自动回复消息 (严格的 XML 格式)
                // 注意：ToUserName 和 FromUserName 必须正确
                const replyXml = `<xml><ToUserName><![CDATA[${openid}]]></ToUserName><FromUserName><![CDATA[${msg.ToUserName}]]></FromUserName><CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[登录成功！]]></Content></xml>`;

                console.log(`[wechat-mp] Callback total ${Date.now() - start}ms, replying with XML`);
                return new Response(replyXml, {
                    headers: { 'Content-Type': 'text/xml' }
                });
            }
        }

        console.log(`[wechat-mp] Callback end (no action) total ${Date.now() - start}ms`);
        return new Response('success');
    } catch (error) {
        console.error('[wechat-mp] Callback error', error);
        return new Response('success');
    }
}
