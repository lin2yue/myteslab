
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
        const start = Date.now();
        const xml = await request.text();
        const result = parser.parse(xml);
        const msg = result.xml;

        console.log(`[wechat-mp] Received ${msg.Event || msg.MsgType} from ${msg.FromUserName}`);

        // MsgType: event, Event: subscribe 或 SCAN
        if (msg.MsgType === 'event' && (msg.Event === 'subscribe' || msg.Event === 'SCAN')) {
            const openid = msg.FromUserName;
            let sceneId = msg.EventKey; // SCAN 事件直接是 sceneId，subscribe 是 qrscene_sceneId
            if (msg.Event === 'subscribe' && sceneId && sceneId.startsWith('qrscene_')) {
                sceneId = sceneId.replace('qrscene_', '');
            }

            if (!sceneId) {
                console.log('[wechat-mp] No sceneId, normal subscribe');
                return new Response('success');
            }

            console.log(`[wechat-mp] Processing scene: ${sceneId}`);

            // 1. 先通过 openid 尝试快速查找用户
            let user = await findUserByWechatOpenId(openid);
            let unionid = user?.union_id || null;

            console.log(`[wechat-mp] User found in DB: ${user ? user.id : 'NO'}`);

            // 2. 如果没找到用户，或者用户名还是默认的，才去调微信接口
            if (!user || user.display_name === '微信用户' || !user.display_name) {
                const userInfoStart = Date.now();
                const userInfo = await getMPUserInfo(openid);
                console.log(`[wechat-mp] getMPUserInfo took ${Date.now() - userInfoStart}ms`, userInfo);

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
                        console.log(`[wechat-mp] Created new user: ${user.id}`);
                    } else if (nickname && (user.display_name === '微信用户' || !user.display_name)) {
                        // 更新已有用户的昵称和头像
                        await dbQuery(
                            `UPDATE users SET display_name = $1, avatar_url = $2 WHERE id = $3`,
                            [nickname, avatar || user.avatar_url, user.id]
                        );
                        console.log(`[wechat-mp] Updated existing user info for: ${user.id}`);
                    }
                }
            }

            // 3. 关联身份并更新会话状态
            if (user) {
                const dbStart = Date.now();
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
                console.log(`[wechat-mp] DB operations took ${Date.now() - dbStart}ms`);

                // 4. 返回自动回复消息 (XML 格式)
                const replyXml = `
<xml>
  <ToUserName><![CDATA[${openid}]]></ToUserName>
  <FromUserName><![CDATA[${msg.ToUserName}]]></FromUserName>
  <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[登录成功！]]></Content>
</xml>`.trim();

                console.log(`[wechat-mp] Callback total time: ${Date.now() - start}ms (with reply)`);
                return new Response(replyXml, {
                    headers: { 'Content-Type': 'text/xml' }
                });
            }
        }

        console.log(`[wechat-mp] Callback total time: ${Date.now() - start}ms`);
        // 显式设置 Content-Type 以确保微信能正确识别
        return new Response('success', {
            headers: { 'Content-Type': 'text/plain' }
        });
    } catch (error) {
        console.error('[wechat-mp] Callback error', error);
        return new Response('success'); // 即使发生内部错误，也对微信返回 success，避免手机端报错
    }
}
