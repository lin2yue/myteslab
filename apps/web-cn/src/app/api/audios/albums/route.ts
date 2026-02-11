import { NextResponse } from 'next/server'
import { getLockAudioAlbums } from '@/lib/lock-audios'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const limit = Number(searchParams.get('limit') || '120')
        const items = await getLockAudioAlbums(limit)

        return NextResponse.json({
            success: true,
            items,
        })
    } catch (error) {
        console.error('[api/audios/albums] 获取专辑列表失败:', error)
        return NextResponse.json({ success: false, error: '获取专辑列表失败' }, { status: 500 })
    }
}
