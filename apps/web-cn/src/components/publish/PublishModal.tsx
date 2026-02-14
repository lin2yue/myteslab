'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from '@/lib/i18n'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import { X, Loader2, Globe, ShieldCheck, DownloadCloud, AlertTriangle } from 'lucide-react'
import Portal from '../Portal';
import { useAlert } from '@/components/alert/AlertProvider'

interface PublishModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (imageBase64: string) => Promise<void>
    modelSlug: string
    modelUrl: string
    wheelUrl?: string
    textureUrl: string
    isPublishing: boolean
}

export default function PublishModal({
    isOpen,
    onClose,
    onConfirm,
    modelSlug,
    modelUrl,
    wheelUrl,
    textureUrl,
    isPublishing
}: PublishModalProps) {
    const t = useTranslations('Common')
    const tGen = useTranslations('Generator')
    const [agree, setAgree] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
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
            // Wait for the visible viewer to be fully ready
            // Reusing the visible viewer saves significant memory on mobile
            const ready = await viewerRef.current.waitForReady(30000)
            if (!ready) {
                console.error('[PublishModal] Viewer did not become ready in time, aborting publish snapshot.')
                alert.error('预览图加载超时，请检查网络并重试。')
                return
            }

            // Capture from the visible instance
            // takeHighResScreenshot with useStandardView: true will temporarily switch
            // to the fixed camera/view, take the shot, and revert.
            const imageBase64 = await viewerRef.current.takeHighResScreenshot({
                useStandardView: true,
                preserveAspect: true
            })

            if (imageBase64) {
                await onConfirm(imageBase64)
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
                            <h2 className="text-xl font-bold text-gray-900">{tGen('publish_preview')}</h2>
                            <p className="text-sm text-gray-500 mt-1">{tGen('publish_preview_desc')}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-black/5 rounded-full transition-colors"
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
                                                <h4 className="text-sm font-bold text-gray-900">{tGen('terms_rule_title')}</h4>
                                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                    {tGen('terms_rule_desc')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                                                <DownloadCloud className="w-5 h-5 text-gray-800 dark:text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900">{tGen('terms_share_title')}</h4>
                                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                    {tGen('terms_share_desc')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                                                <Globe className="w-5 h-5 text-gray-800 dark:text-white" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900">{tGen('terms_public_title')}</h4>
                                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                    {tGen('terms_public_desc')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <label className="flex items-start gap-3 p-4 bg-black/5 dark:bg-white/10 rounded-2xl cursor-pointer hover:bg-black/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="mt-1 w-4 h-4 rounded border-gray-300 text-black focus:ring-black/20"
                                            checked={agree}
                                            onChange={(e) => setAgree(e.target.checked)}
                                        />
                                        <span className="text-xs text-gray-600 leading-normal">
                                            {tGen('terms_agree_checkbox')}
                                        </span>
                                    </label>
                                </div>

                                <div className="flex gap-3 mt-8">
                                    <button
                                        onClick={onClose}
                                        className="flex-1 h-12 rounded-xl border border-black/10 dark:border-white/10 font-bold text-gray-700 hover:bg-black/5 transition-all text-sm"
                                        disabled={isPublishing || isProcessing}
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={!agree || isPublishing || isProcessing}
                                        className={`flex-[2] h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${agree && !isPublishing && !isProcessing ? 'btn-primary h-12' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
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
