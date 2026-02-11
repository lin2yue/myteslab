'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Loader2, Flame, Clock3, Volume2 } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'
import type { LockAudio } from '@/lib/types'
import { getAudioPlayableUrl } from '@/lib/audio'
import { LockAudioCard } from '@/components/audio/LockAudioCard'

type SortBy = 'latest' | 'hot'

type AudioListResponse = {
    success: boolean
    items: LockAudio[]
    hasMore: boolean
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

    const [audios, setAudios] = useState<LockAudio[]>([])
    const [sortBy, setSortBy] = useState<SortBy>('latest')
    const [searchInput, setSearchInput] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [nextPage, setNextPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState('')
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
    }, [loadErrorText, searchQuery, sortBy])

    useEffect(() => {
        setHasMore(true)
        setNextPage(1)
        void fetchAudios(1, true)
    }, [fetchAudios])

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
                await player.play().catch((error) => {
                    console.error('[LockSoundsClient] 恢复播放失败:', error)
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
            }).catch((error) => {
                console.error('[LockSoundsClient] 上报播放次数失败:', error)
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

    const currentAudioTitle = useMemo(() => {
        if (!currentAudioId) return ''
        return audios.find((item) => item.id === currentAudioId)?.title || ''
    }, [audios, currentAudioId])

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

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-center">
                    <label className="relative block">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            placeholder={tLock('search_placeholder')}
                            className="input-field pl-10"
                        />
                    </label>

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
                </div>

                {currentAudioId && (
                    <p className="mt-4 text-xs sm:text-sm text-gray-500 dark:text-zinc-400">
                        {isPlaying ? tLock('now_playing') : tLock('paused')}
                        {currentAudioTitle ? `：${currentAudioTitle}` : ''}
                    </p>
                )}
            </header>

            {loading ? (
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
                    {searchQuery ? tLock('empty_search') : tLock('empty_default')}
                </div>
            ) : (
                <>
                    <div className="space-y-3 sm:space-y-4">
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
            )}
        </section>
    )
}
