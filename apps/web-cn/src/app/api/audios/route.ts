import { NextResponse } from 'next/server'
import { getLockAudios } from '@/lib/lock-audios'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)

        const page = Number(searchParams.get('page') || '1')
        const pageSize = Number(searchParams.get('pageSize') || '20')
        const sortParam = searchParams.get('sort') || 'latest'
        const q = (searchParams.get('q') || '').trim()
        const album = (searchParams.get('album') || '').trim()

        const sortBy = sortParam === 'hot' ? 'hot' : 'latest'
        const data = await getLockAudios(page, pageSize, sortBy, q, album)

        return NextResponse.json({
            success: true,
            items: data.items,
            hasMore: data.hasMore,
            page: Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1),
        })
    } catch (error) {
        console.error('[api/audios] 获取音频列表失败:', error)
        return NextResponse.json({ success: false, error: '获取音频列表失败' }, { status: 500 })
    }
}
