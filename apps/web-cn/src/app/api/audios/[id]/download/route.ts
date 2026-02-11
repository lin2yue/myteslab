import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAudioDownloadUrl } from '@/lib/audio'
import { getSessionUser } from '@/lib/auth/session'

type AudioDownloadRow = {
    id: string
    file_url: string
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getSessionUser()
        if (!user) {
            return NextResponse.json({ success: false, error: '请登录后下载' }, { status: 401 })
        }

        const { id } = await params
        if (!id) {
            return NextResponse.json({ success: false, error: '无效音频ID' }, { status: 400 })
        }

        const { rows } = await dbQuery<AudioDownloadRow>(
            'SELECT id, file_url FROM audios WHERE id = $1 LIMIT 1',
            [id]
        )

        const audio = rows[0]
        if (!audio) {
            return NextResponse.json({ success: false, error: '音频不存在' }, { status: 404 })
        }

        try {
            await dbQuery(
                'UPDATE audios SET download_count = COALESCE(download_count, 0) + 1 WHERE id = $1',
                [id]
            )

            const { rows: relationRows } = await dbQuery<{ table_name: string | null }>(
                `SELECT to_regclass('public.user_audio_downloads') AS table_name`
            )
            if (relationRows[0]?.table_name) {
                await dbQuery(
                    `INSERT INTO user_audio_downloads (user_id, audio_id, downloaded_at)
                     VALUES ($1, $2, NOW())`,
                    [user.id, id]
                )
            }
        } catch (error) {
            // 统计失败不阻塞下载
            console.error('[api/audios/download] 下载统计记录失败:', error)
        }

        const downloadUrl = getAudioDownloadUrl(audio.file_url, audio.id)
        if (!downloadUrl) {
            return NextResponse.json({ success: false, error: '下载地址无效' }, { status: 400 })
        }

        return NextResponse.redirect(downloadUrl, 302)
    } catch (error) {
        console.error('[api/audios/download] 音频下载失败:', error)
        return NextResponse.json({ success: false, error: '下载失败' }, { status: 500 })
    }
}
