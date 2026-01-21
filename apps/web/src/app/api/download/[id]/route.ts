import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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

        // 3. 处理文件获取并强制下载
        let fileBuffer: Buffer | ArrayBuffer;
        let contentType: string;

        if (wrapData.url.startsWith('data:')) {
            // 处理 Base64 DataURL
            const matches = wrapData.url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return NextResponse.json({ error: '无效的贴图数据' }, { status: 500 });
            }
            contentType = matches[1];
            fileBuffer = Buffer.from(matches[2], 'base64');
        } else {
            // 从远程 URL (OSS/CDN) 获取
            const response = await fetch(wrapData.url)
            if (!response.ok) {
                return NextResponse.json(
                    { error: '无法获取贴图文件' },
                    { status: 500 }
                )
            }
            fileBuffer = await response.arrayBuffer();
            contentType = response.headers.get('Content-Type') || 'image/png';
        }

        // 生成文件名
        const filename = `${fileNamePrefix}.png`

        // 返回文件，添加 Content-Disposition header 强制下载
        return new NextResponse(fileBuffer as any, {
            headers: {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': contentType,
            },
        })

    } catch (error) {
        console.error('下载失败:', error)
        return NextResponse.json(
            { error: '下载失败' },
            { status: 500 }
        )
    }
}

