'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { trackDownload } from '@/lib/analytics'

interface DownloadButtonProps {
    wrapId: string
    wrapName: string
    wrapSlug: string
    locale: string
}

export function DownloadButton({ wrapId, wrapName, wrapSlug, locale }: DownloadButtonProps) {
    const [isDownloading, setIsDownloading] = useState(false)
    const t = useTranslations('Common')

    const handleDownload = async () => {
        setIsDownloading(true)

        try {
            // 追踪下载事件到 GA4
            trackDownload(wrapId, wrapName, wrapSlug)

            // 创建一个隐藏的链接来触发下载
            const link = document.createElement('a')
            link.href = `/api/download/${wrapId}`
            link.download = '' // 让浏览器使用服务器指定的文件名
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            // 等待一段时间后重置状态（给用户视觉反馈）
            setTimeout(() => {
                setIsDownloading(false)
            }, 2000)
        } catch (error) {
            console.error('下载失败:', error)
            setIsDownloading(false)
        }
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="block w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg text-center transition-colors"
            >
                <span className="flex items-center justify-center gap-2">
                    {isDownloading ? (
                        <>
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {locale === 'zh' ? '下载中...' : 'Downloading...'}
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            {t('download')}
                        </>
                    )}
                </span>
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
                {t('free_download')}
            </p>
        </div>
    )
}
