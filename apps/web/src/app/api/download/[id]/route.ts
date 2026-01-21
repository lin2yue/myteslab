import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // 1. 获取贴图信息 - 尝试从两个表中获取
        let wrapData: any = null;
        let fileNamePrefix = 'wrap';

        // 先查正式贴图表
        const { data: wrap, error: wrapError } = await supabase
            .from('wraps')
            .select('*')
            .eq('id', id)
            .single()

        if (wrap && !wrapError) {
            wrapData = {
                url: wrap.wrap_image_url || wrap.image_url,
                slug: wrap.slug
            };
            fileNamePrefix = wrap.slug;
        } else {
            // 再查 AI 生成贴图表
            const { data: genWrap, error: genError } = await supabase
                .from('generated_wraps')
                .select('*')
                .eq('id', id)
                .single()

            if (genWrap && !genError) {
                wrapData = {
                    url: genWrap.texture_url,
                    slug: `ai-wrap-${id.substring(0, 8)}`
                };
                fileNamePrefix = wrapData.slug;
            }
        }

        if (!wrapData || !wrapData.url) {
            return NextResponse.json(
                { error: '贴图不存在' },
                { status: 404 }
            )
        }

        // 2. 增加下载计数 (仅对正式贴图)
        if (!id.includes('-') || id.length > 10) { // 简单判断是否是 UUID
            try {
                await supabase.rpc('increment_download_count', {
                    wrap_id: id
                });
            } catch (e) {
                // 忽略可能的报错（例如表不匹配）
            }
        }

        // 3. 从 CDN 获取文件并强制下载
        const response = await fetch(wrapData.url)

        if (!response.ok) {
            return NextResponse.json(
                { error: '无法获取贴图文件' },
                { status: 500 }
            )
        }

        // 获取文件内容
        const blob = await response.blob()

        // 生成文件名
        const filename = `${fileNamePrefix}.png`

        // 返回文件，添加 Content-Disposition header 强制下载
        return new NextResponse(blob, {
            headers: {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': response.headers.get('Content-Type') || 'image/png',
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

