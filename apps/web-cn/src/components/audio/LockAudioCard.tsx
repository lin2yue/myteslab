'use client'

import { Download, Pause, Play, Clock3, Headphones } from 'lucide-react'
import type { LockAudio } from '@/lib/types'
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage'

type LockAudioCardProps = {
    audio: LockAudio
    isPlaying: boolean
    isCurrent: boolean
    isDownloading: boolean
    onPlay: (audio: LockAudio) => void
    onDownload: (audio: LockAudio) => void
}

function formatCount(count: number) {
    if (count >= 10000) {
        return `${(count / 10000).toFixed(1)}万`
    }
    return `${count}`
}

function formatDuration(duration?: number | null) {
    if (!duration || duration <= 0) return '--:--'
    const totalSeconds = Math.floor(duration)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function LockAudioCard({
    audio,
    isPlaying,
    isCurrent,
    isDownloading,
    onPlay,
    onDownload,
}: LockAudioCardProps) {
    return (
        <article className={`bg-white/80 dark:bg-zinc-900/80 rounded-2xl overflow-hidden shadow-none hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_16px_36px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/5 dark:border-white/10 backdrop-blur-sm hover:-translate-y-0.5 p-3 sm:p-4 ${isCurrent ? 'ring-2 ring-black/10 dark:ring-white/20' : ''}`}>
            <div className="flex items-center gap-3 sm:gap-4">
                <button
                    onClick={() => onPlay(audio)}
                    className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 group"
                    aria-label={isCurrent && isPlaying ? `暂停 ${audio.title}` : `试听 ${audio.title}`}
                >
                    {audio.cover_url ? (
                        <ResponsiveOSSImage
                            src={audio.cover_url}
                            alt={audio.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="80px"
                        />
                    ) : (
                        <div className="w-full h-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-zinc-300">
                            <Headphones className="w-6 h-6" />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        {isCurrent && isPlaying ? (
                            <Pause className="w-5 h-5 text-white" />
                        ) : (
                            <Play className="w-5 h-5 text-white ml-0.5" />
                        )}
                    </div>
                </button>

                <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-zinc-100 truncate">
                        {audio.title}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-zinc-400 truncate">
                        {audio.album || '未分类专辑'}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                            <Play className="w-3.5 h-3.5" />
                            {formatCount(audio.play_count || 0)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <Clock3 className="w-3.5 h-3.5" />
                            {formatDuration(audio.duration)}
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => onDownload(audio)}
                    className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-black/5 dark:bg-white/10 text-gray-900 dark:text-zinc-100 border border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 active:scale-[0.98] transition-all text-xs sm:text-sm font-semibold"
                    aria-label={`下载 ${audio.title}`}
                >
                    <Download className="w-4 h-4" />
                    {isDownloading ? '下载中...' : '下载'}
                </button>
            </div>
        </article>
    )
}
