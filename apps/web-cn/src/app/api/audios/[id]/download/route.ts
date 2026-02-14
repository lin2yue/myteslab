import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAudioDownloadUrl } from '@/lib/audio'
import { getSessionUser } from '@/lib/auth/session'

type AudioDownloadRow = {
    id: string
    title: string | null
    file_url: string
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. 基础安全校验
        const user = await getSessionUser()
        if (!user) {
            return NextResponse.json({ success: false, error: '请登录后下载' }, { status: 401 })
        }

        // Referer 校验 (简单防护)
        const referer = request.headers.get('referer');
        if (referer && !referer.includes('tewan.club') && !referer.includes('localhost')) {
            return NextResponse.json({ success: false, error: '非法请求' }, { status: 403 });
        }

        const { id } = await params
        if (!id) {
            return NextResponse.json({ success: false, error: '无效音频ID' }, { status: 400 })
        }

        // 2. 检查下载配额 (每日 20 次)
        const { rows: countRows } = await dbQuery<{ count: string }>(
            `SELECT COUNT(*)::int as count 
             FROM user_audio_downloads 
             WHERE user_id = $1 
             AND downloaded_at > NOW() - INTERVAL '24 hours'`,
            [user.id]
        );

        if (Number(countRows[0]?.count || 0) >= 20) {
            return NextResponse.json({
                success: false,
                error: '已达到每日下载上限 (20次)，请明天再试'
            }, { status: 429 });
        }

        // 3. 获取音频信息
        const { rows } = await dbQuery<AudioDownloadRow>(
            'SELECT id, title, file_url FROM audios WHERE id = $1 LIMIT 1',
            [id]
        )

        const audio = rows[0]
        if (!audio) {
            return NextResponse.json({ success: false, error: '音频不存在' }, { status: 404 })
        }

        const downloadUrl = getAudioDownloadUrl(audio.file_url, audio.id)
        if (!downloadUrl) {
            return NextResponse.json({ success: false, error: '下载地址无效' }, { status: 400 })
        }

        // 4. 统计下载
        try {
            await dbQuery(
                'UPDATE audios SET download_count = COALESCE(download_count, 0) + 1 WHERE id = $1',
                [id]
            )

            await dbQuery(
                `INSERT INTO user_audio_downloads (user_id, audio_id, downloaded_at)
                 VALUES ($1, $2, NOW())`,
                [user.id, id]
            )
        } catch (error) {
            console.error('[api/audios/download] 下载统计记录失败:', error)
        }

        // 5. 代理流式下载 (隐藏真实 URL)
        const fetchHeaders = new Headers();
        fetchHeaders.set('Referer', 'https://tewan.club/');
        fetchHeaders.set('User-Agent', request.headers.get('user-agent') || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const response = await fetch(downloadUrl, {
            headers: fetchHeaders,
        });

        if (!response.ok) {
            console.error('[api/audios/download] 获取资源失败:', {
                status: response.status,
                statusText: response.statusText,
                url: downloadUrl,
                audioId: id
            });
            return NextResponse.json({ success: false, error: '获取资源失败' }, { status: 502 });
        }

        const filename = `${audio.title || 'lock-sound'}.mp3`;
        const headers = new Headers();
        headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        headers.set('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');

        return new NextResponse(response.body, { headers });

    } catch (error) {
        console.error('[api/audios/download] 音频下载异常:', error)
        return NextResponse.json({ success: false, error: '下载失败' }, { status: 500 })
    }
}
