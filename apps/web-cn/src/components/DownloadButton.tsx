'use client'

import { useState } from 'react'
import { useTranslations } from '@/lib/i18n'
import { trackDownload } from '@/lib/analytics'
import Button from '@/components/ui/Button'
import { useRouter } from 'next/navigation'

interface DownloadButtonProps {
    wrapId: string
    wrapName: string
    wrapSlug: string
    locale: string
    isLoggedIn?: boolean
    priceCredits?: number
}

export function DownloadButton({ wrapId, wrapName, wrapSlug, locale, isLoggedIn, priceCredits = 0 }: DownloadButtonProps) {
    const [isDownloading, setIsDownloading] = useState(false)
    const t = useTranslations('Common')
    const router = useRouter()

    const handleDownload = async () => {
        if (!isLoggedIn) {
            const currentUrl = window.location.pathname + window.location.search
            if (typeof window !== 'undefined') {
                localStorage.setItem('auth_redirect_next', currentUrl)
            }
            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
            return
        }

        setIsDownloading(true)

        try {
            const response = await fetch(`/api/download/${wrapId}`, { method: 'GET' })

            if (response.status === 402) {
                const data = await response.json().catch(() => ({}))
                const needCredits = Number(data?.needCredits || priceCredits || 0)
                const hasPaidBalance = Number(data?.hasPaidBalance || 0)
                const msg = locale === 'zh'
                    ? `该作品为付费下载\n需要：${needCredits} 积分\n当前充值积分：${hasPaidBalance} 积分\n\n是否前往充值页？`
                    : `This wrap requires paid credits.\nNeed: ${needCredits} credits\nCurrent paid balance: ${hasPaidBalance} credits\n\nGo to pricing page?`
                if (window.confirm(msg)) {
                    router.push('/pricing')
                }
                setIsDownloading(false)
                return
            }

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status}`)
            }

            // 追踪下载事件到 GA4
            trackDownload(wrapId, wrapName, wrapSlug)

            const blob = await response.blob()
            const objectUrl = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = objectUrl
            link.download = `${wrapSlug || wrapId}.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(objectUrl)

            setIsDownloading(false)
        } catch (error) {
            console.error('下载失败:', error)
            const msg = locale === 'zh' ? '下载失败，请稍后重试' : 'Download failed, please try again later'
            window.alert(msg)
            setIsDownloading(false)
        }
    }

    return (
        <div>
            <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full"
                size="lg"
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
                            {priceCredits > 0
                                ? (locale === 'zh' ? `下载贴图（${priceCredits}积分）` : `Download Texture (${priceCredits} credits)`)
                                : t('download')}
                        </>
                    )}
                </span>
            </Button>
            <p className="text-xs text-gray-500 text-center mt-2">
                {priceCredits > 0
                    ? (locale === 'zh' ? `付费下载：${priceCredits} 积分（使用充值积分）` : `Paid download: ${priceCredits} credits`)
                    : t('free_download')}
            </p>
        </div>
    )
}
