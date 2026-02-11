import type { LockAudio, LockAudioAlbum } from '@/lib/types'
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
    searchQuery: string = '',
    albumFilter: string = ''
): Promise<{ items: LockAudio[]; hasMore: boolean }> {
    try {
        const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
        const safePageSize = Math.min(Math.max(1, Math.floor(pageSize || 20)), 50)
        const safeSort = sortBy === 'hot' ? 'hot' : 'latest'
        const keyword = searchQuery.trim().slice(0, 80)
        const safeAlbum = albumFilter.trim().slice(0, 80)

        return await fetchLockAudiosInternal(safePage, safePageSize, safeSort, keyword, safeAlbum)
    } catch (error) {
        console.error('[getLockAudios] 获取锁车音列表异常:', error)
        return { items: [], hasMore: false }
    }
}

async function fetchLockAudiosInternal(
    page: number,
    pageSize: number,
    sortBy: 'latest' | 'hot',
    keyword: string,
    albumFilter: string
): Promise<{ items: LockAudio[]; hasMore: boolean }> {
    const offset = (page - 1) * pageSize
    const limit = pageSize + 1
    const orderBy = sortBy === 'hot'
        ? 'play_count DESC, created_at DESC'
        : 'created_at DESC'

    const params: Array<number | string> = [limit, offset]
    const whereConditions: string[] = []
    if (keyword) {
        params.push(`%${keyword}%`)
        whereConditions.push(`(title ILIKE $${params.length} OR COALESCE(album, '') ILIKE $${params.length})`)
    }
    if (albumFilter) {
        if (albumFilter === '未分类专辑') {
            whereConditions.push(`(album IS NULL OR BTRIM(album) = '')`)
        } else {
            params.push(albumFilter)
            whereConditions.push(`album = $${params.length}`)
        }
    }
    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

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
        album: audio.album && audio.album.trim() ? audio.album.trim() : '未分类专辑',
        file_url: getAudioPlayableUrl(audio.file_url),
        cover_url: audio.cover_url ? getAudioPlayableUrl(audio.cover_url) : null,
        play_count: Number(audio.play_count || 0),
        download_count: Number(audio.download_count || 0),
        duration: audio.duration === null || audio.duration === undefined ? null : Number(audio.duration),
    }))

    return { items, hasMore }
}

type AlbumRow = {
    album: string
    cover_url: string | null
    audio_count: number | string
    total_play_count: number | string
    latest_created_at: string | null
}

export async function getLockAudioAlbums(
    limit: number = 120,
    sortBy: 'latest' | 'hot' = 'latest'
): Promise<LockAudioAlbum[]> {
    try {
        const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(1, Math.floor(limit)), 500) : 120
        const safeSort = sortBy === 'hot' ? 'hot' : 'latest'
        const orderBy = safeSort === 'hot'
            ? 'total_play_count DESC, audio_count DESC, latest_created_at DESC, album_name ASC'
            : 'latest_created_at DESC, total_play_count DESC, audio_count DESC, album_name ASC'
        const sql = `
            WITH base AS (
                SELECT
                    COALESCE(NULLIF(BTRIM(album), ''), '未分类专辑') AS album_name,
                    cover_url,
                    COALESCE(play_count, 0) AS play_count,
                    created_at
                FROM audios
            )
            SELECT
                album_name AS album,
                COALESCE((ARRAY_REMOVE(ARRAY_AGG(cover_url ORDER BY (cover_url IS NULL), created_at DESC), NULL))[1], NULL) AS cover_url,
                COUNT(*)::int AS audio_count,
                COALESCE(SUM(play_count), 0)::bigint AS total_play_count,
                MAX(created_at) AS latest_created_at
            FROM base
            GROUP BY album_name
            ORDER BY ${orderBy}
            LIMIT $1
        `

        const { rows } = await dbQuery<AlbumRow>(sql, [safeLimit])

        return rows.map((row) => ({
            album: row.album,
            cover_url: row.cover_url ? getAudioPlayableUrl(row.cover_url) : null,
            audio_count: Number(row.audio_count || 0),
            total_play_count: Number(row.total_play_count || 0),
            latest_created_at: row.latest_created_at,
        }))
    } catch (error) {
        console.error('[getLockAudioAlbums] 获取专辑列表异常:', error)
        return []
    }
}
