
import { NextResponse } from 'next/server';
import { getMPOAuthUserInfo } from '@/lib/wechat-mp';
import { dbQuery } from '@/lib/db';
import { findUserByWechatOpenId, findUserByWechatUnionId, createUser, linkWechatMPIdentity, DbUser } from '@/lib/auth/users';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const sceneId = searchParams.get('state'); // We passed sceneId as state

    if (!code || !sceneId) {
        return new Response('Invalid request: missing code or sceneId', { status: 400 });
    }

    try {
        console.log(`[wechat-mp] OAuth Callback: code=${code}, sceneId=${sceneId}`);

        // 1. 获取授权用户信息 (包含昵称、头像、openid、unionid)
        const userInfo = await getMPOAuthUserInfo(code);

        if (!userInfo || !userInfo.openid) {
            console.error('[wechat-mp] Failed to get OAuth user info', userInfo);
            return new Response('授权失败，请重试', { status: 500 });
        }

        const { openid, unionid, nickname, headimgurl } = userInfo;
        console.log(`[wechat-mp] Got OAuth user info for openid=${openid}, nickname=${nickname}`);

        // 2. 找到或创建用户
        let user: DbUser | null = null;

        if (unionid) {
            user = await findUserByWechatUnionId(unionid);
        }

        if (!user) {
            user = await findUserByWechatOpenId(openid);
        }

        if (!user) {
            // 创建新用户
            user = await createUser({
                displayName: nickname || '微信用户',
                avatarUrl: headimgurl || null,
            });
            console.log(`[wechat-mp] Created new user via OAuth: ${user.id}`);
        } else if (nickname && (!user.display_name || user.display_name === '微信用户')) {
            // 更新背景资料
            await dbQuery(
                `UPDATE users SET display_name = $1, avatar_url = $2 WHERE id = $3`,
                [nickname, headimgurl || user.avatar_url, user.id]
            );
        }

        // 3. 关联身份
        await linkWechatMPIdentity(user.id, openid, unionid);

        // 4. 更新会话状态，通知前端 PC 登录成功
        await dbQuery(
            `UPDATE wechat_qr_sessions 
             SET status = 'COMPLETED', user_id = $1 
             WHERE scene_id = $2`,
            [user.id, sceneId]
        );

        console.log(`[wechat-mp] OAuth Login COMPLETED for scene ${sceneId}, user ${user.id}`);

        // 5. 返回成功提示 HTML
        return new NextResponse(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>登录成功</title>
                <style>
                    body { font-family: -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
                    .card { background: white; padding: 2rem; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; max-width: 80%; }
                    .icon { font-size: 64px; color: #07c160; margin-bottom: 1rem; }
                    h1 { font-size: 22px; color: #333; margin: 0 0 10px 0; }
                    p { font-size: 15px; color: #666; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">✓</div>
                    <h1>登录成功</h1>
                    <p>您已成功登录 Tewan Club。<br>网页端将自动跳转，请返回查看。</p>
                </div>
                <script>
                    setTimeout(() => {
                        if (typeof WeixinJSBridge !== 'undefined') {
                            WeixinJSBridge.call('closeWindow');
                        }
                    }, 3000);
                </script>
            </body>
            </html>
        `, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (error) {
        console.error('[wechat-mp] OAuth Callback error', error);
        return new Response('服务器内部错误', { status: 500 });
    }
}
