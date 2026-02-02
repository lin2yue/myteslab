'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { getMaskUrl } from '@/lib/ai/mask-config'
import { useRouter } from 'next/navigation'
import { useAlert } from '@/components/alert/AlertProvider'

interface StickerEditorProps {
    modelSlug: string
    onTextureUpdate: (dataUrl: string) => void
    onSave: (dataUrl: string) => Promise<any>
    isSaving?: boolean
    isLoggedIn?: boolean
}

export default function StickerEditor({
    modelSlug,
    onTextureUpdate,
    onSave,
    isSaving = false,
    isLoggedIn = false
}: StickerEditorProps) {
    const t = useTranslations('Generator')
    const alert = useAlert()
    const [stickerImage, setStickerImage] = useState<string | null>(null)
    const [currentMergedTexture, setCurrentMergedTexture] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const locale = useLocale()

    // Automatically re-process image when model changes to adapt to new dimensions
    useEffect(() => {
        if (stickerImage) {
            processImage(stickerImage)
        }
    }, [modelSlug])

    const processImage = async (imageSrc: string) => {
        setIsProcessing(true)
        console.log('Starting image processing with orientation correction for model:', modelSlug)
        try {
            // 1. Load sticker image
            const stickerImg = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image()
                img.src = imageSrc
                img.onload = () => resolve(img)
                img.onerror = () => reject(new Error('无法加载您上传的图片，请检查文件格式'))
            })

            // 2. Determine target dimensions based on model
            // Standardizing on 1024x1024 for textures, Cybertruck uses 1024x768 
            const isCybertruck = modelSlug === 'cybertruck'
            const designWidth = isCybertruck ? 1024 : 1024
            const designHeight = isCybertruck ? 768 : 1024

            // 3. Simple composite: Draw sticker to fill the design area
            const canvas = document.createElement('canvas')
            canvas.width = designWidth
            canvas.height = designHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('无法创建画布上下文')

            // Fill black background
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, designWidth, designHeight)

            // 4. Perform standardized rotation to match 3D UV format
            // Based on user feedback:
            // Cybertruck -> 90deg CW (Official is Heading Left)
            // Model 3/Y -> 180deg (Official is Heading Up)
            ctx.save();
            ctx.translate(designWidth / 2, designHeight / 2);

            if (isCybertruck) {
                // Cybertruck: 顺时针旋转 270 度 (或逆时针 90 度) -> 车头向左 (1024x768)
                // 注：用户上传的贴纸通常车头向上 (Heading Up)，逆时针 90 度正好向左
                ctx.rotate(-90 * Math.PI / 180);
                const scale = Math.max(designHeight / stickerImg.width, designWidth / stickerImg.height)
                const w = stickerImg.width * scale
                const h = stickerImg.height * scale
                ctx.drawImage(stickerImg, -w / 2, -h / 2, w, h)
            } else {
                ctx.rotate(180 * Math.PI / 180);
                // Heading down -> 180 deg -> Heading UP. Correct!
                const scale = Math.max(designWidth / stickerImg.width, designHeight / stickerImg.height)
                const w = stickerImg.width * scale
                const h = stickerImg.height * scale
                ctx.drawImage(stickerImg, -w / 2, -h / 2, w, h)
            }
            ctx.restore();

            const finalDataUrl = canvas.toDataURL('image/png')

            setCurrentMergedTexture(finalDataUrl)
            onTextureUpdate(finalDataUrl)
            console.log('Image processing completed with orientation correction')
        } catch (err: any) {
            console.error('Processing error:', err)
            alert.error(err.message || '图片处理失败，请重试')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onloadend = () => {
            const result = reader.result as string
            setStickerImage(result)
            processImage(result)
        }
        reader.readAsDataURL(file)
    }

    const handleSave = () => {
        if (currentMergedTexture) {
            onSave(currentMergedTexture)
        }
    }

    return (
        <div className="flex flex-col gap-0">
            <div className="p-4 flex flex-col gap-5">
                <div className="relative">
                    {!stickerImage ? (
                        <button
                            type="button"
                            onClick={() => {
                                if (!isLoggedIn) {
                                    const currentUrl = window.location.pathname + window.location.search
                                    router.push(`/${locale}/login?next=${encodeURIComponent(currentUrl)}`)
                                    return
                                }
                                fileInputRef.current?.click()
                            }}
                            className="w-full h-48 border-2 border-dashed border-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/10 transition-all bg-gray-50/30 group"
                        >
                            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 border border-gray-100 group-hover:scale-110 transition-transform">
                                <span className="text-3xl text-blue-500">+</span>
                            </div>
                            <span className="text-base font-bold text-gray-700">{t('upload_sticker')}</span>
                            <p className="text-xs text-gray-400 mt-2 px-6 text-center">
                                上传图片，系统将自动将其应用到整车侧身
                            </p>
                        </button>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center p-2">
                                <img
                                    src={stickerImage}
                                    className="max-w-full max-h-full object-contain shadow-sm"
                                    alt="Uploaded"
                                />
                                {(isProcessing || isSaving) && (
                                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center backdrop-blur-[1px]">
                                        <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 h-12 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg font-bold transition-all text-sm border border-gray-100 disabled:opacity-50"
                                >
                                    更换图片
                                </button>
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => {
                                        setStickerImage(null)
                                        setCurrentMergedTexture(null)
                                        onTextureUpdate('')
                                    }}
                                    className="w-12 h-12 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg flex items-center justify-center transition-all border border-red-50 disabled:opacity-50"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleImageUpload}
                    />
                </div>

                <div className="pt-2">
                    <button
                        onClick={handleSave}
                        disabled={!currentMergedTexture || isProcessing || isSaving}
                        className="w-full h-12 bg-black text-white rounded-lg font-bold hover:bg-zinc-800 transition-all active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 text-sm flex items-center justify-center gap-2"
                    >
                        {(isProcessing || isSaving) ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                {isSaving ? '正在保存...' : '处理中...'}
                            </>
                        ) : t('save_diy')}
                    </button>
                    <p className="mt-4 text-[11px] text-gray-400 text-center leading-relaxed">
                        💡 提示：上传高清图片可获得更好的贴图效果。<br />支持 PNG、JPG、WebP 格式。
                    </p>
                </div>
            </div>
        </div>
    )
}
