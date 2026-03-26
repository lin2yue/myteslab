'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, ZoomIn } from 'lucide-react'
import Portal from '@/components/Portal'
import { getOptimizedImageUrl } from '@/lib/images'

interface TexturePreviewModalProps {
    textureUrl: string
    altText?: string
}

export default function TexturePreviewModal({ textureUrl, altText }: TexturePreviewModalProps) {
    const [isOpen, setIsOpen] = useState(false)

    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])

    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, close])

    const previewUrl = getOptimizedImageUrl(textureUrl, { width: 1600, format: 'webp' })

    return (
        <>
            {/* 触发按钮（悬浮遮罩） */}
            <button
                onClick={open}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[1px] w-full"
                aria-label="Preview texture"
            >
                <span className="text-white text-[10px] font-bold tracking-widest uppercase bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5">
                    <ZoomIn className="w-3 h-3" />
                    View Preview
                </span>
            </button>

            {/* 弹窗 */}
            {isOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        {/* 背景遮罩 */}
                        <div
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={close}
                        />

                        {/* 弹窗主体 */}
                        <div className="relative z-10 w-full max-w-4xl rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6)] border border-white/10 bg-zinc-950">
                            {/* 顶栏 */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Texture Preview
                                </span>
                                <button
                                    onClick={close}
                                    className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>

                            {/* 图片区域（防右键+水印） */}
                            <div
                                className="relative select-none bg-zinc-900"
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                {/* 图片 */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={previewUrl}
                                    alt={altText || 'Texture preview'}
                                    draggable={false}
                                    className="w-full h-auto max-h-[75vh] object-contain pointer-events-none"
                                    style={{ userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
                                />

                                {/* 水印层 */}
                                <div
                                    className="absolute inset-0 pointer-events-none overflow-hidden"
                                    aria-hidden="true"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='110'%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial,sans-serif' font-size='16' font-weight='700' fill='rgba(255,255,255,0.45)' transform='rotate(-30 110 55)'%3Etewan.club%3C/text%3E%3C/svg%3E")`,
                                        backgroundSize: '220px 110px',
                                    }}
                                />
                            </div>

                            {/* 底部提示 */}
                            <div className="px-4 py-2.5 border-t border-white/10 text-center">
                                <p className="text-[10px] text-gray-600 tracking-wide">
                                    Preview only · Download available after unlocking
                                </p>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </>
    )
}
