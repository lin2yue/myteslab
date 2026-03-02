'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import { X, Loader2, Globe, ShieldCheck, DownloadCloud } from 'lucide-react'
import Portal from '../Portal'

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
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
    const [renderAttempt, setRenderAttempt] = useState(0)
    const hiddenViewerRef = useRef<ModelViewerRef>(null)

    const previewParams = {
        cameraOrbit: '225deg 75deg 85%',
        fieldOfView: '30deg',
        backgroundColor: '#FFFFFF',
        exposure: 1.0,
        environmentImage: 'neutral',
        shadowIntensity: 1,
        shadowSoftness: 1
    }

    useEffect(() => {
        if (!isOpen) {
            setPreviewImage(null)
            setPreviewError(null)
            setIsGeneratingPreview(false)
            return
        }

        let cancelled = false

        const generatePreview = async () => {
            setPreviewImage(null)
            setPreviewError(null)
            setIsGeneratingPreview(true)

            try {
                let viewer: ModelViewerRef | null = null
                const refDeadline = Date.now() + 5000
                while (!viewer && Date.now() < refDeadline) {
                    viewer = hiddenViewerRef.current
                    if (!viewer) {
                        await new Promise(resolve => setTimeout(resolve, 50))
                    }
                }

                if (!viewer) {
                    throw new Error('Preview renderer failed to initialize')
                }

                const ready = await viewer.waitForReady(30000)
                if (!ready) {
                    throw new Error('Preview loading timed out, please retry')
                }

                const imageBase64 = await viewer.takeHighResScreenshot({
                    useStandardView: true,
                    preserveAspect: true
                })

                if (!imageBase64) {
                    throw new Error('Preview capture failed')
                }

                if (!cancelled) {
                    setPreviewImage(imageBase64)
                }
            } catch (error) {
                console.error('[PublishModal] Failed to pre-render publish preview:', error)
                if (!cancelled) {
                    setPreviewError(error instanceof Error ? error.message : 'Preview generation failed')
                }
            } finally {
                if (!cancelled) {
                    setIsGeneratingPreview(false)
                }
            }
        }

        void generatePreview()

        return () => {
            cancelled = true
        }
    }, [isOpen, modelSlug, modelUrl, wheelUrl, textureUrl, renderAttempt])

    const handleConfirm = async () => {
        if (!previewImage) {
            return
        }

        setIsProcessing(true)
        try {
            await onConfirm(previewImage)
        } catch (error) {
            console.error('Failed to confirm publish:', error)
        } finally {
            setIsProcessing(false)
        }
    }

    const canConfirm = agree && !isPublishing && !isProcessing && !isGeneratingPreview && Boolean(previewImage)

    if (!isOpen) return null

    return (
        <Portal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white/90 dark:bg-zinc-900/80 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.35)] animate-in fade-in zoom-in duration-300 border border-black/5 dark:border-white/10 backdrop-blur">
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

                    <div className="flex-1 overflow-y-auto p-6 md:p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-4">
                                <div className="aspect-[4/3] bg-[#1F1F1F] rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden relative shadow-inner">
                                    {previewImage ? (
                                        <img
                                            src={previewImage}
                                            alt="Publish preview"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
                                            <Loader2 className={`w-8 h-8 ${isGeneratingPreview ? 'animate-spin' : ''}`} />
                                            <div className="text-center px-6">
                                                <p className="text-sm font-semibold">
                                                    {isGeneratingPreview ? 'Generating publish preview...' : 'Publish preview generation failed'}
                                                </p>
                                                <p className="text-xs text-white/60 mt-1">
                                                    {isGeneratingPreview ? 'First render may take longer on slower devices' : (previewError || 'Please retry')}
                                                </p>
                                            </div>
                                            {!isGeneratingPreview && previewError ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setRenderAttempt((value) => value + 1)}
                                                    className="mt-2 rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                                                >
                                                    Regenerate preview
                                                </button>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 text-center italic">
                                    * {tGen('preview_consistency_hint')}
                                </p>
                            </div>

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
                                        disabled={!canConfirm}
                                        className={`flex-[2] h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${canConfirm ? 'btn-primary h-12' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
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

                    {isGeneratingPreview || (!previewImage && !previewError) ? (
                        <div
                            style={{
                                position: 'fixed',
                                left: 0,
                                top: 0,
                                width: '1024px',
                                height: '768px',
                                opacity: 0.01,
                                pointerEvents: 'none',
                                zIndex: -1
                            }}
                            aria-hidden="true"
                        >
                            <ModelViewer
                                ref={hiddenViewerRef}
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
                        </div>
                    ) : null}
                </div>
            </div>
        </Portal>
    )
}
