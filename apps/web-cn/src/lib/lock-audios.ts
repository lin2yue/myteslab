import type { LockAudio } from '@/lib/types'
import { dbQuery } from '@/lib/db'
import { getAudioPlayableUrl } from '@/lib/audio'

type AudioRow = {
    id: string
    title: string
    album: string | null
    file_url: string
    cover_url: string | null
    duration: number | null
    tags: string[] | null
    play_count: number | null
    download_count: number | null
    created_at: string
}

export async function getLockAudios(
    page: number = 1,
    pageSize: number = 20,
    sortBy: 'latest' | 'hot' = 'latest',
    searchQuery: string = ''
): Promise<{ items: LockAudio[]; hasMore: boolean }> {
    try {
        const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
        const safePageSize = Math.min(Math.max(1, Math.floor(pageSize || 20)), 50)
        const safeSort = sortBy === 'hot' ? 'hot' : 'latest'
        const keyword = searchQuery.trim().slice(0, 80)

        return await fetchLockAudiosInternal(safePage, safePageSize, safeSort, keyword)
    } catch (error) {
        console.error('[getLockAudios] 获取锁车音列表异常:', error)
        return { items: [], hasMore: false }
    }
}

async function fetchLockAudiosInternal(
    page: number,
    pageSize: number,
    sortBy: 'latest' | 'hot',
    keyword: string
): Promise<{ items: LockAudio[]; hasMore: boolean }> {
    const offset = (page - 1) * pageSize
    const limit = pageSize + 1
    const orderBy = sortBy === 'hot'
        ? 'play_count DESC, created_at DESC'
        : 'created_at DESC'

    const params: Array<number | string> = [limit, offset]
    let whereSql = ''
    if (keyword) {
        params.push(`%${keyword}%`)
        whereSql = `WHERE (title ILIKE $${params.length} OR album ILIKE $${params.length})`
    }

    const sql = `
        SELECT id, title, album, file_url, cover_url, duration, tags, play_count, download_count, created_at
        FROM audios
        ${whereSql}
        ORDER BY ${orderBy}
        LIMIT $1
        OFFSET $2
    `

    const { rows } = await dbQuery<AudioRow>(sql, params)
    const hasMore = rows.length > pageSize
    const safeRows = hasMore ? rows.slice(0, pageSize) : rows

    const items: LockAudio[] = safeRows.map((audio) => ({
        ...audio,
        file_url: getAudioPlayableUrl(audio.file_url),
        cover_url: audio.cover_url ? getAudioPlayableUrl(audio.cover_url) : null,
        play_count: Number(audio.play_count || 0),
        download_count: Number(audio.download_count || 0),
        duration: audio.duration === null || audio.duration === undefined ? null : Number(audio.duration),
    }))

    return { items, hasMore }
}
