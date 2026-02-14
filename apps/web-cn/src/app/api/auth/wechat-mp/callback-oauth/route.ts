import { NextResponse } from 'next/server';
import { getMPOAuthUserInfo } from '@/lib/wechat-mp';
import { dbQuery } from '@/lib/db';
import { findUserByWechatOpenId, findUserByWechatUnionId, createUser, linkWechatMPIdentity, DbUser, updateUserInfo } from '@/lib/auth/users';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const sceneId = searchParams.get('state');

    if (!code || !sceneId) {
        return new Response('Invalid request: missing code or sceneId', { status: 400 });
    }

    try {
        // 1. 获取授权用户信息
        const userInfo = await getMPOAuthUserInfo(code);

        if (!userInfo || !userInfo.openid) {
            console.error('[wechat-mp] Failed to get OAuth user info', userInfo);
            return new Response('授权失败，请重试', { status: 500 });
        }

        const { openid, unionid, nickname, headimgurl } = userInfo;

        // 2. 找到或创建用户
        let user: DbUser | null = null;
        if (unionid) user = await findUserByWechatUnionId(unionid);
        if (!user) user = await findUserByWechatOpenId(openid);

        if (!user) {
            user = await createUser({
                displayName: nickname || '微信用户',
                avatarUrl: headimgurl || null,
            });
        } else if (nickname && (!user.display_name || user.display_name === '微信用户' || /^\d+$/.test(user.display_name || ''))) {
            // 更新背景资料 (包括处理纯数字昵称的旧数据)，使用统一同步接口
            await updateUserInfo(user.id, {
                displayName: nickname,
                avatarUrl: headimgurl || user.avatar_url
            });
        }

        // 3. 关联身份
        await linkWechatMPIdentity(user.id, openid, unionid);

        // 4. 更新会话状态
        await dbQuery(
            `UPDATE wechat_qr_sessions SET status = 'COMPLETED', user_id = $1 WHERE scene_id = $2`,
            [user.id, sceneId]
        );

        // 5. 返回精美成功页面
        return new NextResponse(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
                <title>登录成功</title>
                <style>
                    body { font-family: -apple-system, system-ui, sans-serif; background: #f7f7f7; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .container { text-align: center; padding: 40px 20px; }
                    .icon-box { width: 80px; height: 80px; background: #07C160; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; box-shadow: 0 10px 20px rgba(7,193,96,0.2); }
                    .checkmark { color: white; font-size: 44px; font-weight: bold; }
                    h1 { font-size: 22px; color: #191919; margin-bottom: 8px; font-weight: 600; }
                    p { font-size: 15px; color: #808080; line-height: 1.6; margin: 0; }
                    .brand { position: fixed; bottom: 40px; left: 0; right: 0; color: #B2B2B2; font-size: 13px; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon-box">
                        <span class="checkmark">✓</span>
                    </div>
                    <h1>登录成功</h1>
                    <p>您已成功授权登录 Tewan Club<br>PC端网页将自动跳转，请返回查看</p>
                    <div class="brand">Powered by Tewan Club</div>
                </div>
                <script>
                    setTimeout(() => {
                        window.close();
                        if (typeof WeixinJSBridge !== 'undefined') {
                            WeixinJSBridge.call('closeWindow');
                        }
                    }, 2500);
                </script>
            </body>
            </html>
        `, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (error: any) {
        return new Response('服务器错误', { status: 500 });
    }
}
