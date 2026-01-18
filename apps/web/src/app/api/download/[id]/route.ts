import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // 1. 获取贴图信息
        const { data: wrap, error } = await supabase
            .from('wraps')
            .select('*')
            .eq('id', id)
            .single()

        if (error || !wrap) {
            return NextResponse.json(
                { error: '贴图不存在' },
                { status: 404 }
            )
        }

        // 2. 增加下载计数
        await supabase.rpc('increment_download_count', {
            wrap_id: id
        })

        // 3. 获取贴图文件 URL（优先使用 wrap_image_url，否则使用 image_url）
        const wrapUrl = wrap.wrap_image_url || wrap.image_url

        if (!wrapUrl) {
            return NextResponse.json(
                { error: '贴图文件不存在' },
                { status: 404 }
            )
        }

        // 4. 从 CDN 获取文件并强制下载
        const response = await fetch(wrapUrl)

        if (!response.ok) {
            return NextResponse.json(
                { error: '无法获取贴图文件' },
                { status: 500 }
            )
        }

        // 获取文件内容
        const blob = await response.blob()

        // 生成文件名（使用 wrap slug 作为文件名）
        const filename = `${wrap.slug}.png`

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
