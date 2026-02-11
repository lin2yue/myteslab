'use client'

import { Headphones, Layers, PlayCircle } from 'lucide-react'
import type { LockAudioAlbum } from '@/lib/types'
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage'

type LockAlbumCardProps = {
    album: LockAudioAlbum
    onOpen: (album: LockAudioAlbum) => void
}

function formatCount(count: number) {
    if (count >= 10000) {
        return `${(count / 10000).toFixed(1)}万`
    }
    return `${count}`
}

export function LockAlbumCard({ album, onOpen }: LockAlbumCardProps) {
    return (
        <button
            type="button"
            className="bg-white/80 dark:bg-zinc-900/80 rounded-2xl overflow-hidden shadow-none hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_16px_36px_rgba(0,0,0,0.10)] transition-all duration-300 border border-black/5 dark:border-white/10 backdrop-blur-sm hover:-translate-y-0.5 p-3 sm:p-4 text-left"
            onClick={() => onOpen(album)}
            aria-label={`查看专辑 ${album.album}`}
        >
            <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-black/5 dark:bg-white/10">
                {album.cover_url ? (
                    <ResponsiveOSSImage
                        src={album.cover_url}
                        alt={album.album}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1280px) 50vw, 25vw"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-zinc-300">
                        <Layers className="w-7 h-7" />
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <div className="absolute left-2.5 bottom-2.5">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/45 border border-white/20 text-[10px] font-semibold text-white">
                        <Headphones className="w-3 h-3" />
                        {album.audio_count} 首音频
                    </span>
                </div>
            </div>

            <div className="mt-3">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-zinc-100 truncate">
                    {album.album}
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400 inline-flex items-center gap-1">
                    <PlayCircle className="w-3.5 h-3.5" />
                    总播放 {formatCount(album.total_play_count)}
                </p>
            </div>
        </button>
    )
}
