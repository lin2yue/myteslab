import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDownloadUrl } from '@/lib/oss'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()

        // 1. 获取贴图信息 - 从合并后的 wraps 表拉取
        const { data: wrap, error: wrapError } = await supabase
            .from('wraps')
            .select('*')
            .eq('id', id)
            .single()

        if (wrapError || !wrap) {
            return NextResponse.json({ error: '贴图不存在' }, { status: 404 })
        }

        const wrapData = {
            url: wrap.texture_url,
            slug: wrap.slug || `wrap-${id.substring(0, 8)}`
        };
        const fileNamePrefix = wrapData.slug;
        const downloadFilename = `${fileNamePrefix}.png`;

        if (!wrapData || !wrapData.url) {
            return NextResponse.json(
                { error: '贴图不存在' },
                { status: 404 }
            )
        }

        // 2. 增加下载计数并记录下载历史
        const { data: { user } } = await supabase.auth.getUser();

        // 增加总下载量
        await supabase.rpc('increment_download_count', {
            wrap_id: id
        });

        // 如果用户已登录，记录到个人下载历史
        if (user) {
            await supabase.from('user_downloads').insert({
                user_id: user.id,
                wrap_id: id
            });
        }

        // 3. 优化下载逻辑：生成带 Response-Content-Disposition 的签名 URL
        if (wrapData.url.startsWith('data:')) {
            // 兼容 Base64 DataURL (虽然线上实际上全是 OSS URL)
            const matches = wrapData.url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return NextResponse.json({ error: '无效的贴图数据' }, { status: 500 });
            }
            const contentType = matches[1];
            const fileBuffer = Buffer.from(matches[2], 'base64');

            return new NextResponse(fileBuffer as any, {
                headers: {
                    'Content-Disposition': `attachment; filename="${downloadFilename}"`,
                    'Content-Type': contentType,
                },
            });
        } else {
            // 获取带签名且强制触发下载的 URL (不消耗 Vercel 流量)
            const signedDownloadUrl = await getDownloadUrl(wrapData.url, downloadFilename);

            // 返回 302 重定向
            return NextResponse.redirect(signedDownloadUrl);
        }

    } catch (error) {
        console.error('下载失败:', error)
        return NextResponse.json(
            { error: '下载失败' },
            { status: 500 }
        )
    }
}

