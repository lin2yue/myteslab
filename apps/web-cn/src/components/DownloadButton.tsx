'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from '@/lib/i18n'
import { trackDownload } from '@/lib/analytics'
import Button from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import Portal from '@/components/Portal'
import { getCurrentPathWithSearch, rememberAuthRedirectNext } from '@/lib/auth/client-redirect'

interface DownloadButtonProps {
    wrapId: string
    wrapName: string
    wrapSlug: string
    locale: string
    isLoggedIn?: boolean
    isOwner?: boolean
    priceCredits?: number
}

interface CreditsBalanceResponse {
    balance?: number
    paid_balance?: number
    gift_balance?: number
    reserved?: number
}

export function DownloadButton({ wrapId, wrapName, wrapSlug, locale, isLoggedIn, isOwner = false, priceCredits = 0 }: DownloadButtonProps) {
    const [isDownloading, setIsDownloading] = useState(false)
    const [showPayModal, setShowPayModal] = useState(false)
    const [isPurchasing, setIsPurchasing] = useState(false)
    const [needCredits, setNeedCredits] = useState<number>(priceCredits)
    const [paidBalance, setPaidBalance] = useState<number>(0)
    const [giftBalance, setGiftBalance] = useState<number>(0)
    const [alreadyPurchased, setAlreadyPurchased] = useState(false)

    const t = useTranslations('Common')
    const router = useRouter()

    const fetchCreditsBalance = async () => {
        try {
            const res = await fetch('/api/credits/balance', { cache: 'no-store' })
            if (!res.ok) return
            const data = (await res.json()) as CreditsBalanceResponse
            setPaidBalance(Number(data.paid_balance || 0))
            setGiftBalance(Number(data.gift_balance || 0))
        } catch {
            // ignore
        }
    }

    const checkAccessStatus = async () => {
        if (!isLoggedIn || isOwner || priceCredits <= 0) {
            setAlreadyPurchased(false)
            return
        }
        try {
            const accessRes = await fetch(`/api/marketplace/access/${wrapId}`, { cache: 'no-store' })
            const accessData = await accessRes.json().catch(() => ({} as { purchased?: boolean }))
            setAlreadyPurchased(Boolean(accessRes.ok && accessData?.purchased))
        } catch {
            // ignore
        }
    }

    useEffect(() => {
        void checkAccessStatus()
    }, [isLoggedIn, isOwner, priceCredits, wrapId])

    const triggerBrowserDownload = async () => {
        const response = await fetch(`/api/download/${wrapId}`, { method: 'GET' })

        if (response.status === 402) {
            const data = await response.json().catch(() => ({} as { needCredits?: number; hasPaidBalance?: number; hasGiftBalance?: number }))
            const need = Number(data?.needCredits || priceCredits || 0)
            setNeedCredits(need)
            setPaidBalance(Number(data?.hasPaidBalance || 0))
            setGiftBalance(Number(data?.hasGiftBalance || 0))
            await fetchCreditsBalance()
            setShowPayModal(true)
            return false
        }

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`)
        }

        const blob = await response.blob()
        const objectUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = `${wrapSlug || wrapId}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(objectUrl)

        // 成功后埋点
        trackDownload(wrapId, wrapName, wrapSlug)
        return true
    }

    const handleDownload = async () => {
        if (!isLoggedIn) {
            const currentUrl = getCurrentPathWithSearch('/')
            rememberAuthRedirectNext(currentUrl)
            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
            return
        }

        // 付费作品：先检查是否已购买，已购则直接下载；未购再弹二次确认
        if (priceCredits > 0 && !isOwner) {
            try {
                const accessRes = await fetch(`/api/marketplace/access/${wrapId}`, { cache: 'no-store' })
                const accessData = await accessRes.json().catch(() => ({} as {
                    purchased?: boolean
                    needCredits?: number
                    hasPaidBalance?: number
                    hasGiftBalance?: number
                }))

                if (accessRes.ok && accessData?.purchased) {
                    setAlreadyPurchased(true)
                    // 已购买，直接下载，不再弹窗
                } else {
                    setAlreadyPurchased(false)
                    setNeedCredits(Number(accessData?.needCredits || priceCredits))
                    setPaidBalance(Number(accessData?.hasPaidBalance || 0))
                    setGiftBalance(Number(accessData?.hasGiftBalance || 0))
                    if (!accessRes.ok) {
                        await fetchCreditsBalance()
                    }
                    setShowPayModal(true)
                    return
                }
            } catch {
                setNeedCredits(priceCredits)
                await fetchCreditsBalance()
                setShowPayModal(true)
                return
            }
        }

        setIsDownloading(true)

        try {
            await triggerBrowserDownload()
        } catch (error) {
            console.error('下载失败:', error)
            const msg = locale === 'zh' ? '下载失败，请稍后重试' : 'Download failed, please try again later'
            window.alert(msg)
        } finally {
            setIsDownloading(false)
        }
    }

    const handlePurchaseWithCredits = async () => {
        setIsPurchasing(true)
        try {
            const res = await fetch(`/api/marketplace/purchase/${wrapId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            const data = await res.json().catch(() => ({} as { error?: string; remainingPaidBalance?: number }))

            if (!res.ok) {
                throw new Error(data?.error || '购买失败，请重试')
            }

            setPaidBalance(Number(data?.remainingPaidBalance || 0))
            setAlreadyPurchased(true)
            setShowPayModal(false)

            // 购买成功后自动继续下载
            setIsDownloading(true)
            await triggerBrowserDownload()
            setIsDownloading(false)
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '购买失败，请重试'
            window.alert(message)
        } finally {
            setIsPurchasing(false)
        }
    }

    const handleAlipayTopup = async () => {
        setIsPurchasing(true)
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: matchedTopup.productId,
                    locale,
                    metadata: {
                        source: 'paid_wrap_download',
                        wrapId,
                        wrapSlug,
                        needCredits,
                        paidBalance,
                    }
                }),
            })
            const data = await response.json().catch(() => ({} as { url?: string; error?: string }))

            if (data.url) {
                window.location.href = data.url
                return
            }

            throw new Error(data.error || '支付拉起失败，请重试')
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '支付拉起失败，请重试'
            window.alert(message)
            setIsPurchasing(false)
        }
    }

    const shortByCredits = Math.max(needCredits - paidBalance, 0)
    const topupPackages = [
        { credits: 30, yuan: 9, productId: 'starter' },
        { credits: 60, yuan: 19, productId: 'explorer' },
        { credits: 120, yuan: 39, productId: 'advanced' },
        { credits: 240, yuan: 79, productId: 'collector' },
    ]
    const matchedTopup = topupPackages.find(p => p.credits >= shortByCredits) || topupPackages[topupPackages.length - 1]
    const topupYuan = matchedTopup.yuan

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
                                ? (alreadyPurchased
                                    ? (locale === 'zh' ? '下载贴图（已购买）' : 'Download Texture (Purchased)')
                                    : (locale === 'zh' ? `下载贴图（${priceCredits}积分）` : `Download Texture (${priceCredits} credits)`))
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

            {showPayModal && (
                <Portal>
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => !isPurchasing && setShowPayModal(false)} />
                        <div className="relative w-full max-w-sm rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/90 shadow-[0_20px_60px_rgba(0,0,0,0.4)] p-5 backdrop-blur">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100">付费下载</h3>
                            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">该作品需使用充值积分购买后下载</p>

                            <div className="mt-4 space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-500 dark:text-zinc-400">作品价格</span>
                                    <span className="font-semibold text-gray-900 dark:text-zinc-100">{needCredits} 积分</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-500 dark:text-zinc-400">当前可用余额（充值积分）</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{paidBalance} 积分</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-500 dark:text-zinc-400">不可用余额（系统赠予）</span>
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">{giftBalance} 积分</span>
                                </div>
                            </div>

                            <div className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2">
                                系统赠予积分不可用于积分下载
                            </div>

                            <div className="mt-5 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    className="h-9 px-3 rounded-lg text-sm border border-black/10 dark:border-white/15 text-gray-600 dark:text-zinc-300"
                                    onClick={() => setShowPayModal(false)}
                                    disabled={isPurchasing}
                                >
                                    取消
                                </button>

                                {paidBalance >= needCredits ? (
                                    <button
                                        type="button"
                                        onClick={handlePurchaseWithCredits}
                                        disabled={isPurchasing}
                                        className="h-9 px-3 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-60"
                                    >
                                        {isPurchasing ? '购买中...' : `支付${needCredits}积分 立即下载`}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleAlipayTopup}
                                        disabled={isPurchasing}
                                        className="h-9 px-3 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-60"
                                    >
                                        {isPurchasing ? '正在拉起支付宝...' : `支付${topupYuan}元 立即下载`}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    )
}
