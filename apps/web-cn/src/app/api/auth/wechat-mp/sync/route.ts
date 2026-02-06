
import { NextResponse } from 'next/server';
import { getMPOAuthUserInfo } from '@/lib/wechat-mp';
import { dbQuery } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const userId = searchParams.get('state'); // We passed userId as state

    if (!code || !userId) {
        return new Response('Invalid request: missing code or userId', { status: 400 });
    }

    try {
        console.log(`[wechat-mp] Syncing user info for ${userId} with code ${code}`);

        // 1. 获取授权用户信息 (包含昵称和头像)
        const userInfo = await getMPOAuthUserInfo(code);

        if (!userInfo || !userInfo.nickname) {
            console.error('[wechat-mp] Failed to get OAuth user info or nickname missing', userInfo);
            return new Response('Failed to sync user info. Please try again.', { status: 500 });
        }

        const { nickname, headimgurl } = userInfo;
        console.log(`[wechat-mp] Got OAuth user info: ${nickname}`);

        // 2. 更新数据库
        await dbQuery(
            `UPDATE users 
             SET display_name = $1, avatar_url = $2 
             WHERE id = $3`,
            [nickname, headimgurl || null, userId]
        );

        console.log(`[wechat-mp] Successfully updated user ${userId} with real info`);

        // 3. 返回成功提示并自动关闭或跳转
        // 我们可以返回一个简单的 HTML，提示成功并使用 JS 尝试关闭网页（如果在微信内）
        return new NextResponse(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>同步成功</title>
                <style>
                    body { font-family: -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
                    .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
                    .icon { font-size: 48px; color: #07c160; margin-bottom: 1rem; }
                    h1 { font-size: 20px; color: #333; margin: 0 0 10px 0; }
                    p { font-size: 14px; color: #666; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">✓</div>
                    <h1>同步成功</h1>
                    <p>您的昵称和头像已更新，请返回网页查看。</p>
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
        console.error('[wechat-mp] Sync error', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
