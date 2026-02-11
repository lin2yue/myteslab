'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Loader2, Flame, Clock3, Volume2, X } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'
import type { LockAudio, LockAudioAlbum } from '@/lib/types'
import { getAudioPlayableUrl } from '@/lib/audio'
import { LockAudioCard } from '@/components/audio/LockAudioCard'
import { LockAlbumCard } from '@/components/audio/LockAlbumCard'

type SortBy = 'latest' | 'hot'
type ViewMode = 'audios' | 'albums'

type AudioListResponse = {
    success: boolean
    items: LockAudio[]
    hasMore: boolean
}

type AlbumListResponse = {
    success: boolean
    items: LockAudioAlbum[]
}

const PAGE_SIZE = 20

function mergeAudios(previous: LockAudio[], incoming: LockAudio[]) {
    const map = new Map<string, LockAudio>()
    for (const audio of previous) {
        map.set(audio.id, audio)
    }
    for (const audio of incoming) {
        map.set(audio.id, audio)
    }
    return Array.from(map.values())
}

export default function LockSoundsClient() {
    const tCommon = useTranslations('Common')
    const tLock = useTranslations('LockSounds')
    const loadErrorText = tLock('load_error')

    const [viewMode, setViewMode] = useState<ViewMode>('audios')
    const [selectedAlbum, setSelectedAlbum] = useState('')

    const [audios, setAudios] = useState<LockAudio[]>([])
    const [albums, setAlbums] = useState<LockAudioAlbum[]>([])

    const [sortBy, setSortBy] = useState<SortBy>('latest')
    const [searchInput, setSearchInput] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [nextPage, setNextPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)

    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [albumsLoading, setAlbumsLoading] = useState(false)

    const [error, setError] = useState('')
    const [albumsError, setAlbumsError] = useState('')

    const [currentAudioId, setCurrentAudioId] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [downloadingId, setDownloadingId] = useState<string | null>(null)

    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearchQuery(searchInput.trim())
        }, 300)

        return () => {
            window.clearTimeout(timer)
        }
    }, [searchInput])

    useEffect(() => {
        const player = new Audio()
        player.preload = 'none'

        const handlePlay = () => setIsPlaying(true)
        const handlePause = () => setIsPlaying(false)
        const handleEnded = () => setIsPlaying(false)

        player.addEventListener('play', handlePlay)
        player.addEventListener('pause', handlePause)
        player.addEventListener('ended', handleEnded)
        audioRef.current = player

        return () => {
            player.pause()
            player.src = ''
            player.removeEventListener('play', handlePlay)
            player.removeEventListener('pause', handlePause)
            player.removeEventListener('ended', handleEnded)
            audioRef.current = null
        }
    }, [])

    const fetchAudios = useCallback(async (page: number, reset: boolean) => {
        if (reset) {
            setLoading(true)
        } else {
            setLoadingMore(true)
        }

        setError('')

        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(PAGE_SIZE),
                sort: sortBy,
            })

            if (searchQuery) {
                params.set('q', searchQuery)
            }
            if (selectedAlbum) {
                params.set('album', selectedAlbum)
            }

            const response = await fetch(`/api/audios?${params.toString()}`, {
                method: 'GET',
                cache: 'no-store',
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const data = (await response.json()) as AudioListResponse
            if (!data.success) {
                throw new Error('request_failed')
            }

            setAudios((prev) => (reset ? data.items : mergeAudios(prev, data.items)))
            setHasMore(Boolean(data.hasMore))
            setNextPage(page + 1)
        } catch (fetchError) {
            console.error('[LockSoundsClient] 获取音频失败:', fetchError)
            setError(loadErrorText)
            if (reset) {
                setAudios([])
            }
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }, [loadErrorText, searchQuery, selectedAlbum, sortBy])

    const fetchAlbums = useCallback(async () => {
        setAlbumsLoading(true)
        setAlbumsError('')
        try {
            const response = await fetch('/api/audios/albums?limit=200', {
                method: 'GET',
                cache: 'no-store',
            })
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            const data = (await response.json()) as AlbumListResponse
            if (!data.success) {
                throw new Error('request_failed')
            }
            setAlbums(data.items)
        } catch (fetchError) {
            console.error('[LockSoundsClient] 获取专辑失败:', fetchError)
            setAlbumsError(loadErrorText)
            setAlbums([])
        } finally {
            setAlbumsLoading(false)
        }
    }, [loadErrorText])

    useEffect(() => {
        if (viewMode !== 'audios') return
        setHasMore(true)
        setNextPage(1)
        void fetchAudios(1, true)
    }, [fetchAudios, viewMode])

    useEffect(() => {
        if (viewMode !== 'albums') return
        if (albums.length > 0) return
        void fetchAlbums()
    }, [albums.length, fetchAlbums, viewMode])

    const handleLoadMore = useCallback(() => {
        if (loading || loadingMore || !hasMore) return
        void fetchAudios(nextPage, false)
    }, [fetchAudios, hasMore, loading, loadingMore, nextPage])

    const handlePlay = useCallback(async (audio: LockAudio) => {
        const player = audioRef.current
        if (!player) return

        const playableUrl = getAudioPlayableUrl(audio.file_url)
        if (!playableUrl) return

        if (currentAudioId === audio.id) {
            if (player.paused) {
                await player.play().catch((playError) => {
                    console.error('[LockSoundsClient] 恢复播放失败:', playError)
                })
            } else {
                player.pause()
            }
            return
        }

        try {
            player.pause()
            player.src = playableUrl
            player.currentTime = 0
            setCurrentAudioId(audio.id)
            await player.play()

            setAudios((prev) => prev.map((item) => (
                item.id === audio.id
                    ? { ...item, play_count: Number(item.play_count || 0) + 1 }
                    : item
            )))

            void fetch(`/api/audios/${audio.id}/play`, {
                method: 'POST',
            }).catch((playReportError) => {
                console.error('[LockSoundsClient] 上报播放次数失败:', playReportError)
            })
        } catch (playError) {
            console.error('[LockSoundsClient] 播放失败:', playError)
        }
    }, [currentAudioId])

    const handleDownload = useCallback((audio: LockAudio) => {
        setDownloadingId(audio.id)
        setAudios((prev) => prev.map((item) => (
            item.id === audio.id
                ? { ...item, download_count: Number(item.download_count || 0) + 1 }
                : item
        )))

        const link = document.createElement('a')
        link.href = `/api/audios/${audio.id}/download`
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        window.setTimeout(() => {
            setDownloadingId((current) => (current === audio.id ? null : current))
        }, 1200)
    }, [])

    const handleOpenAlbum = useCallback((album: LockAudioAlbum) => {
        setSelectedAlbum(album.album)
        setSearchInput('')
        setSearchQuery('')
        setViewMode('audios')
    }, [])

    const clearAlbumFilter = useCallback(() => {
        setSelectedAlbum('')
    }, [])

    const currentAudioTitle = useMemo(() => {
        if (!currentAudioId) return ''
        return audios.find((item) => item.id === currentAudioId)?.title || ''
    }, [audios, currentAudioId])

    const filteredAlbums = useMemo(() => {
        if (!searchQuery) return albums
        const keyword = searchQuery.toLowerCase()
        return albums.filter((item) => item.album.toLowerCase().includes(keyword))
    }, [albums, searchQuery])

    return (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
            <header className="panel-muted p-5 sm:p-6 mb-6">
                <div className="flex flex-col gap-3">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E31937] bg-[#E31937]/10 border border-[#E31937]/20 rounded-full px-3 py-1 w-fit">
                        <Volume2 className="w-3.5 h-3.5" />
                        {tLock('badge')}
                    </div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                        {tLock('title')}
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
                        {tLock('subtitle')}
                    </p>
                </div>

                <div className="mt-6 flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('audios')}
                        className={`h-10 px-4 rounded-xl text-sm font-semibold transition-all ${viewMode === 'audios'
                            ? 'bg-black text-white dark:bg-white dark:text-black'
                            : 'bg-black/5 dark:bg-white/10 text-gray-700 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/15'
                            }`}
                    >
                        {tLock('tab_audios')}
                    </button>
                    <button
                        onClick={() => setViewMode('albums')}
                        className={`h-10 px-4 rounded-xl text-sm font-semibold transition-all ${viewMode === 'albums'
                            ? 'bg-black text-white dark:bg-white dark:text-black'
                            : 'bg-black/5 dark:bg-white/10 text-gray-700 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/15'
                            }`}
                    >
                        {tLock('tab_albums')}
                    </button>
                </div>

                <div className={`mt-4 grid grid-cols-1 ${viewMode === 'audios' ? 'sm:grid-cols-[1fr_auto_auto]' : 'sm:grid-cols-[1fr_auto]'} gap-3 items-center`}>
                    <label className="relative block">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            placeholder={viewMode === 'audios' ? tLock('search_placeholder') : tLock('search_album_placeholder')}
                            className="input-field pl-10"
                        />
                    </label>

                    {viewMode === 'audios' && (
                        <button
                            onClick={() => setSortBy('latest')}
                            className={`h-11 px-4 rounded-xl text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${sortBy === 'latest'
                                ? 'bg-black text-white dark:bg-white dark:text-black'
                                : 'bg-black/5 dark:bg-white/10 text-gray-700 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/15'
                                }`}
                        >
                            <Clock3 className="w-4 h-4" />
                            {tLock('sort_latest')}
                        </button>
                    )}

                    {viewMode === 'audios' && (
                        <button
                            onClick={() => setSortBy('hot')}
                            className={`h-11 px-4 rounded-xl text-sm font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${sortBy === 'hot'
                                ? 'bg-black text-white dark:bg-white dark:text-black'
                                : 'bg-black/5 dark:bg-white/10 text-gray-700 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/15'
                                }`}
                        >
                            <Flame className="w-4 h-4" />
                            {tLock('sort_hot')}
                        </button>
                    )}
                </div>

                {viewMode === 'audios' && selectedAlbum && (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15">
                        <span className="text-xs text-gray-600 dark:text-zinc-300">
                            {tLock('filtered_by_album')}：{selectedAlbum}
                        </span>
                        <button
                            type="button"
                            onClick={clearAlbumFilter}
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-black/10 dark:hover:bg-white/15 text-gray-500 dark:text-zinc-300"
                            aria-label={tLock('clear_album_filter')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {viewMode === 'audios' && currentAudioId && (
                    <p className="mt-4 text-xs sm:text-sm text-gray-500 dark:text-zinc-400">
                        {isPlaying ? tLock('now_playing') : tLock('paused')}
                        {currentAudioTitle ? `：${currentAudioTitle}` : ''}
                    </p>
                )}
            </header>

            {viewMode === 'audios' ? (
                loading ? (
                    <div className="panel-muted p-8 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {tCommon('loading')}
                    </div>
                ) : error ? (
                    <div className="panel-muted p-8 text-center">
                        <p className="text-sm text-red-500">{error}</p>
                        <button
                            onClick={() => void fetchAudios(1, true)}
                            className="mt-4 btn-secondary"
                        >
                            {tLock('retry')}
                        </button>
                    </div>
                ) : audios.length === 0 ? (
                    <div className="panel-muted p-10 text-center text-sm text-gray-500 dark:text-zinc-400">
                        {searchQuery || selectedAlbum ? tLock('empty_search') : tLock('empty_default')}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3 sm:gap-4">
                            {audios.map((audio) => (
                                <LockAudioCard
                                    key={audio.id}
                                    audio={audio}
                                    isCurrent={currentAudioId === audio.id}
                                    isPlaying={currentAudioId === audio.id && isPlaying}
                                    isDownloading={downloadingId === audio.id}
                                    onPlay={handlePlay}
                                    onDownload={handleDownload}
                                />
                            ))}
                        </div>

                        <div className="mt-6 flex items-center justify-center">
                            {hasMore ? (
                                <button
                                    onClick={handleLoadMore}
                                    disabled={loadingMore}
                                    className="btn-secondary min-w-36"
                                >
                                    {loadingMore ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {tLock('loading_more')}
                                        </span>
                                    ) : (
                                        tLock('load_more')
                                    )}
                                </button>
                            ) : (
                                <span className="text-xs text-gray-400 dark:text-zinc-500">
                                    {tLock('no_more')}
                                </span>
                            )}
                        </div>
                    </>
                )
            ) : albumsLoading ? (
                <div className="panel-muted p-8 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tCommon('loading')}
                </div>
            ) : albumsError ? (
                <div className="panel-muted p-8 text-center">
                    <p className="text-sm text-red-500">{albumsError}</p>
                    <button
                        onClick={() => void fetchAlbums()}
                        className="mt-4 btn-secondary"
                    >
                        {tLock('retry')}
                    </button>
                </div>
            ) : filteredAlbums.length === 0 ? (
                <div className="panel-muted p-10 text-center text-sm text-gray-500 dark:text-zinc-400">
                    {searchQuery ? tLock('empty_album_search') : tLock('empty_album_default')}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {filteredAlbums.map((album) => (
                        <LockAlbumCard key={album.album} album={album} onOpen={handleOpenAlbum} />
                    ))}
                </div>
            )}
        </section>
    )
}
