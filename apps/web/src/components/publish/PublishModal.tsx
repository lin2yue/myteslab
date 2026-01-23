'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import { X, Loader2, Globe, ShieldCheck, DownloadCloud } from 'lucide-react'

interface PublishModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => Promise<void>
    modelSlug: string
    modelUrl: string
    textureUrl: string
    isPublishing: boolean
}

export default function PublishModal({
    isOpen,
    onClose,
    onConfirm,
    modelSlug,
    modelUrl,
    textureUrl,
    isPublishing
}: PublishModalProps) {
    const t = useTranslations('Common')
    const tGen = useTranslations('Generator')
    const [agree, setAgree] = useState(false)
    const viewerRef = useRef<ModelViewerRef>(null)

    if (!isOpen) return null

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{tGen('publish_preview')}</h2>
                        <p className="text-sm text-gray-500 mt-1">{tGen('publish_preview_desc')}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        disabled={isPublishing}
                    >
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                        {/* Left: 3D Preview */}
                        <div className="flex flex-col gap-4">
                            <div className="aspect-square bg-[#FFFFFF] rounded-2xl border border-gray-100 overflow-hidden relative shadow-inner">
                                <ModelViewer
                                    ref={viewerRef}
                                    modelUrl={modelUrl}
                                    textureUrl={textureUrl}
                                    modelSlug={modelSlug}
                                    backgroundColor={previewParams.backgroundColor}
                                    autoRotate={false}
                                    className="w-full h-full"
                                    cameraOrbit={previewParams.cameraOrbit}
                                    fieldOfView={previewParams.fieldOfView}
                                    cameraControls={false}
                                />
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/10 backdrop-blur-md rounded-full text-[10px] text-gray-500 font-medium">
                                    3D Preview (Fixed Angle)
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
                                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900">{tGen('terms_rule_title')}</h4>
                                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                {tGen('terms_rule_desc')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                            <DownloadCloud className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900">{tGen('terms_share_title')}</h4>
                                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                {tGen('terms_share_desc')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                            <Globe className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-gray-900">{tGen('terms_public_title')}</h4>
                                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                {tGen('terms_public_desc')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                                    className="flex-1 h-12 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-all text-sm"
                                    disabled={isPublishing}
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={onConfirm}
                                    disabled={!agree || isPublishing}
                                    className={`flex-[2] h-12 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${agree && !isPublishing ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                >
                                    {isPublishing ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            {tGen('publishing')}
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
    )
}
