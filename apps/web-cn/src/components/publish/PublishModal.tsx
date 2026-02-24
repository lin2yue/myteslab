'use client'

import { useState, useRef } from 'react'
import { useTranslations } from '@/lib/i18n'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import { X, Loader2, Globe, ShieldCheck, DownloadCloud, AlertTriangle, Store, CheckCircle2 } from 'lucide-react'
import Portal from '../Portal';
import { useAlert } from '@/components/alert/AlertProvider'

export interface MarketplaceOptions {
    enabled: boolean;
    priceCredits: number;
}

interface PublishModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (imageBase64: string, marketplaceOptions?: MarketplaceOptions) => Promise<void>
    modelSlug: string
    modelUrl: string
    wheelUrl?: string
    textureUrl: string
    isPublishing: boolean
    isCreator?: boolean
}

const PRICE_OPTIONS = [
    { label: '免费', value: 0, desc: '0 积分' },
    { label: '30 积分', value: 30, desc: '约 ¥3' },
    { label: '100 积分', value: 100, desc: '约 ¥10' },
    { label: '360 积分', value: 360, desc: '约 ¥36' },
] as const;

export default function PublishModal({
    isOpen,
    onClose,
    onConfirm,
    modelSlug,
    modelUrl,
    wheelUrl,
    textureUrl,
    isPublishing,
    isCreator = false,
}: PublishModalProps) {
    const t = useTranslations('Common')
    const tGen = useTranslations('Generator')
    const [agree, setAgree] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [marketplaceEnabled, setMarketplaceEnabled] = useState(false)
    const [selectedPrice, setSelectedPrice] = useState(0)
    const alert = useAlert()
    const viewerRef = useRef<ModelViewerRef>(null)

    // Params from render_config.json to match the generation script exactly
    const previewParams = {
        cameraOrbit: "225deg 75deg 85%",
        fieldOfView: "30deg",
        backgroundColor: "#FFFFFF",
        exposure: 1.0,
        environmentImage: "neutral",
        shadowIntensity: 1,
        shadowSoftness: 1
    }

    if (!isOpen) return null

    const handleConfirm = async () => {
        if (!viewerRef.current) {
            alert.error('预览系统未就绪，请稍后重试')
            return
        }

        setIsProcessing(true)
        try {
            const ready = await viewerRef.current.waitForReady(30000)
            if (!ready) {
                console.error('[PublishModal] Viewer did not become ready in time, aborting publish snapshot.')
                alert.error('预览图加载超时，请检查网络并重试。')
                return
            }

            const imageBase64 = await viewerRef.current.takeHighResScreenshot({
                useStandardView: true,
                preserveAspect: true
            })

            if (imageBase64) {
                const marketplaceOptions: MarketplaceOptions | undefined = isCreator
                    ? { enabled: marketplaceEnabled, priceCredits: marketplaceEnabled ? selectedPrice : 0 }
                    : undefined;
                await onConfirm(imageBase64, marketplaceOptions)
            } else {
                alert.error('图抓取失败，请重试')
            }
        } catch (error) {
            console.error('Failed to capture snapshot:', error)
            alert.error('发布失败：' + (error instanceof Error ? error.message : '未知错误'))
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <Portal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white/90 dark:bg-zinc-900/80 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.35)] animate-in fade-in zoom-in duration-300 border border-black/5 dark:border-white/10 backdrop-blur">

                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-black/5 dark:border-white/10">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{tGen('publish_preview')}</h2>
                            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{tGen('publish_preview_desc')}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                            disabled={isPublishing || isProcessing}
                        >
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                            {/* Left: 3D Preview (User facing) */}
                            <div className="flex flex-col gap-4">
                                <div className="aspect-[4/3] bg-[#1F1F1F] rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden relative shadow-inner">
                                    <ModelViewer
                                        ref={viewerRef}
                                        modelUrl={modelUrl}
                                        wheelUrl={wheelUrl}
                                        textureUrl={textureUrl}
                                        modelSlug={modelSlug}
                                        backgroundColor="#1F1F1F"
                                        autoRotate={false}
                                        className="w-full h-full"
                                        cameraOrbit={previewParams.cameraOrbit}
                                        fieldOfView={previewParams.fieldOfView}
                                        cameraControls={false}
                                    />
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full text-[10px] text-white/70 font-medium">
                                        3D Preview (Live)
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 text-center italic">
                                    * {tGen('preview_consistency_hint')}
                                </p>
                            </div>

                            {/* Right: Terms & Buttons */}
                            <div className="flex flex-col justify-between py-2">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                                                <ShieldCheck className="w-5 h-5 text-gray-800 dark:text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100">{tGen('terms_rule_title')}</h4>
                                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                                    {tGen('terms_rule_desc')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                                                <DownloadCloud className="w-5 h-5 text-gray-800 dark:text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100">{tGen('terms_share_title')}</h4>
                                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                                    {tGen('terms_share_desc')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                                                <Globe className="w-5 h-5 text-gray-800 dark:text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100">{tGen('terms_public_title')}</h4>
                                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                                    {tGen('terms_public_desc')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 创作者商城区块 */}
                                    {isCreator && (
                                        <div className="border-t border-black/5 dark:border-white/10 pt-4">
                                            <label className="flex items-start gap-3 cursor-pointer group">
                                                <div className="relative mt-0.5">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={marketplaceEnabled}
                                                        onChange={(e) => setMarketplaceEnabled(e.target.checked)}
                                                    />
                                                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${marketplaceEnabled ? 'bg-amber-500 border-amber-500' : 'border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}>
                                                        {marketplaceEnabled && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Store className="w-4 h-4 text-amber-500" />
                                                        <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">同时发布到商城</span>
                                                        <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">认证创作者专属</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                                                        发布后用户需消耗充值积分下载，你将获得 70% 收益
                                                    </p>
                                                </div>
                                            </label>

                                            {marketplaceEnabled && (
                                                <div className="mt-4 space-y-2">
                                                    <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">选择售价</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {PRICE_OPTIONS.map((option) => (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                onClick={() => setSelectedPrice(option.value)}
                                                                className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left ${selectedPrice === option.value
                                                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                                                    : 'border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 bg-white/50 dark:bg-zinc-800/50'
                                                                    }`}
                                                            >
                                                                <span className={`text-sm font-bold ${selectedPrice === option.value ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-zinc-100'}`}>
                                                                    {option.label}
                                                                </span>
                                                                <span className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{option.desc}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {selectedPrice > 0 && (
                                                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                                            你将获得 {Math.floor(selectedPrice * 0.7)} 积分 / 次下载
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <label className="flex items-start gap-3 p-4 bg-black/5 dark:bg-white/10 rounded-2xl cursor-pointer hover:bg-black/10 dark:hover:bg-white/15 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="mt-1 w-4 h-4 rounded border-gray-300 text-black focus:ring-black/20"
                                            checked={agree}
                                            onChange={(e) => setAgree(e.target.checked)}
                                        />
                                        <span className="text-xs text-gray-600 dark:text-zinc-400 leading-normal">
                                            {tGen('terms_agree_checkbox')}
                                        </span>
                                    </label>
                                </div>

                                <div className="flex gap-3 mt-8">
                                    <button
                                        onClick={onClose}
                                        className="flex-1 h-12 rounded-xl border border-black/10 dark:border-white/10 font-bold text-gray-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-all text-sm"
                                        disabled={isPublishing || isProcessing}
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={!agree || isPublishing || isProcessing}
                                        className={`flex-[2] h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${agree && !isPublishing && !isProcessing ? 'btn-primary h-12' : 'bg-gray-200 dark:bg-zinc-700 text-gray-400 dark:text-zinc-500 cursor-not-allowed'}`}
                                    >
                                        {isPublishing || isProcessing ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                {isPublishing ? tGen('publishing') : tGen('preparing_preview')}
                                            </>
                                        ) : (
                                            <>
                                                <Globe className="w-5 h-5" />
                                                {tGen('confirm_publish')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </Portal>
    )
}
