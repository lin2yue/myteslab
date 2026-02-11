import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        if (!id) {
            return NextResponse.json({ success: false, error: '无效音频ID' }, { status: 400 })
        }

        const { rowCount } = await dbQuery(
            'UPDATE audios SET play_count = COALESCE(play_count, 0) + 1 WHERE id = $1',
            [id]
        )

        if (!rowCount) {
            return NextResponse.json({ success: false, error: '音频不存在' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[api/audios/play] 更新播放计数失败:', error)
        return NextResponse.json({ success: false, error: '更新播放计数失败' }, { status: 500 })
    }
}
