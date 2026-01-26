'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import { Link } from '@/i18n/routing'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'
import StickerEditor from '@/components/sticker/StickerEditor'
import {
    Sun, Moon, RotateCw, Pause, Camera, Download, Globe, Check, Loader2,
    Sparkles, ChevronDown, X, Plus, Palette, ArrowRight
} from 'lucide-react'
import PricingModal from '@/components/pricing/PricingModal'
import { useRouter } from '@/i18n/routing'
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage'
import PublishModal from '@/components/publish/PublishModal'
import { useAlert } from '@/components/alert/AlertProvider'

interface GenerationHistory {
    id: string
    prompt: string
    preview_url: string
    texture_url: string
    model_slug: string
    is_active: boolean
    is_public: boolean
    created_at: string
}

export default function AIGeneratorMain({
    initialCredits,
    models,
    locale: _locale,
    isLoggedIn
}: {
    initialCredits: number,
    models: Array<{ slug: string; name: string; modelUrl?: string }>,
    locale: string,
    isLoggedIn: boolean
}) {
    const t = useTranslations('Common')
    const tIndex = useTranslations('Index')
    const tGen = useTranslations('Generator')
    const alert = useAlert()
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'

    const getCdnUrl = (url: string) => {
        if (url && url.includes('aliyuncs.com')) {
            try {
                const urlObj = new URL(url)
                return `${cdnUrl}${urlObj.pathname}${urlObj.search}`
            } catch (e) {
                return url
            }
        }
        return url
    }

    const getProxyUrl = useCallback((url: string, options?: { stable?: boolean }) => {
        if (!url) return '';
        const effectiveUrl = getCdnUrl(url);

        if (effectiveUrl.includes('cdn.tewan.club')) {
            return effectiveUrl;
        }

        if (effectiveUrl.startsWith('http') && typeof window !== 'undefined' && !effectiveUrl.includes(window.location.origin)) {
            return `/api/proxy?url=${encodeURIComponent(effectiveUrl)}`;
        }
        return effectiveUrl;
    }, [cdnUrl])

    const supabase = useMemo(() => createClient(), [])

    const [balance, setBalance] = useState(initialCredits)
    const [selectedModel, setSelectedModel] = useState(models[0]?.slug || 'cybertruck')
    const [prompt, setPrompt] = useState('')
    const [activeMode, setActiveMode] = useState<'ai' | 'diy'>('ai')
    const [isGenerating, setIsGenerating] = useState(false)
    const [history, setHistory] = useState<GenerationHistory[]>([])
    const [currentTexture, setCurrentTexture] = useState<string | null>(null)
    const [activeWrapId, setActiveWrapId] = useState<string | null>(null)
    const [isPublishing, setIsPublishing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [referenceImages, setReferenceImages] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [showPricing, setShowPricing] = useState(false)
    const router = useRouter()
    const [showPublishModal, setShowPublishModal] = useState(false)

    // 3D 控制状态
    const [isNight, setIsNight] = useState(false)
    const [autoRotate, setAutoRotate] = useState(true)
    const viewerRef = useRef<ModelViewerRef>(null)
    const isFetchingRef = useRef(false)
    const [isLoggedInInternal, setIsLoggedInInternal] = useState(isLoggedIn)

    // Sync internal login state with prop
    useEffect(() => {
        setIsLoggedInInternal(isLoggedIn)
    }, [isLoggedIn])


    // 获取历史记录
    const [isFetchingHistory, setIsFetchingHistory] = useState(false)
    const fetchHistory = useCallback(async () => {
        if (isFetchingRef.current) return
        isFetchingRef.current = true
        setIsFetchingHistory(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const user = session?.user
            if (!user) {
                console.log('fetchHistory: No user found')
                setHistory([])
                return
            }

            let query = supabase
                .from('wraps')
                .select('*')
                .eq('user_id', user.id)
                .is('deleted_at', null)

            // Strictly filter by category defined at writing
            if (activeMode === 'diy') {
                query = query.eq('category', 'diy')
            } else {
                query = query.eq('category', 'ai_generated')
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(10)

            if (error) {
                console.error('Supabase query error:', error)
                throw error
            }

            if (data) {
                setHistory(data)
            } else {
                setHistory([])
            }
        } catch (err) {
            console.error('Fetch history error:', err)
            // Optional: could set an error state here to show in UI
            setHistory([]) // Ensure we exit loading state
        } finally {
            isFetchingRef.current = false
            setIsFetchingHistory(false)
        }
    }, [supabase, activeMode])

    useEffect(() => {
        let isMounted = true
        if (isMounted) {
            console.log('AIGeneratorMain: Running fetchHistory due to mount or mode change')
            fetchHistory()
        }

        // 监听登录状态变化
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!isMounted) return
            const hasUser = !!session?.user
            setIsLoggedInInternal(hasUser)

            if (hasUser && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                fetchHistory()
            }
            if (event === 'SIGNED_OUT') {
                setHistory([])
                setBalance(0)
            }
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [fetchHistory, supabase])

    // 生成逻辑
    const handleGenerate = async () => {
        if (!isLoggedInInternal) {
            const currentUrl = window.location.pathname + window.location.search
            if (typeof window !== 'undefined') {
                localStorage.setItem('auth_redirect_next', currentUrl)
            }
            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
            return
        }
        if (!prompt.trim() || isGenerating) return
        if (balance <= 0) {
            alert.warning('积分不足，请先购买生成包')
            return
        }

        setIsGenerating(true)
        try {
            const res = await fetch('/api/wrap/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelSlug: selectedModel,
                    prompt: prompt.trim(),
                    referenceImages: referenceImages
                })
            })

            const data = await res.json()
            if (!data.success) throw new Error(data.error)

            setCurrentTexture(data.image.dataUrl) // 服务器已经返回了纠正后的贴图
            setActiveWrapId(data.wrapId) // 使用作品 ID 而非任务 ID

            // 更新余额
            setBalance(data.remainingBalance)

            // 刷新历史
            setTimeout(fetchHistory, 1000)

        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            alert.error(`生成失败: ${message}`)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleDownload = async () => {
        if (!currentTexture) return;

        // 如果有作品 ID，直接使用专门的下载接口（解决跨域和文件名问题）
        if (activeWrapId) {
            const link = document.createElement('a');
            link.href = `/api/download/${activeWrapId}`;
            link.click();
            return;
        }

        // 备选方案：如果是本地刚生成的 DataURL
        let dataUrl = currentTexture;
        if (currentTexture.startsWith('http')) {
            try {
                const res = await fetch(currentTexture);
                const blob = await res.blob();
                dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch (err) {
                console.error('Fetch failed, falling back to direct link:', err);
            }
        }

        const link = document.createElement('a');
        link.download = `wrap-${selectedModel}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
    };

    const handleSaveDiy = async (dataUrl: string) => {
        if (!isLoggedInInternal) {
            const currentUrl = window.location.pathname + window.location.search
            if (typeof window !== 'undefined') {
                localStorage.setItem('auth_redirect_next', currentUrl)
            }
            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
            return null
        }
        setIsSaving(true);
        try {
            const res = await fetch('/api/wrap/save-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelSlug: selectedModel,
                    imageBase64: dataUrl,
                    prompt: 'DIY Sticker'
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            setActiveWrapId(data.wrapId);
            fetchHistory();
            return data.wrapId;
        } catch (err) {
            alert.error('保存失败：' + (err instanceof Error ? err.message : String(err)));
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!isLoggedInInternal) {
            const currentUrl = window.location.pathname + window.location.search
            if (typeof window !== 'undefined') {
                localStorage.setItem('auth_redirect_next', currentUrl)
            }
            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
            return
        }
        if (!viewerRef.current) return;

        // 已经发布了就不再操作
        const currentWrap = activeWrapId ? history.find(h => h.id === activeWrapId) : null;
        if (currentWrap?.is_public) return;

        // 打开预览弹窗，而不再直接执行发布
        setShowPublishModal(true);
    };

    const confirmPublish = async (previewImageBase64: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert.warning('Please login again');
            return;
        }

        setIsPublishing(true);
        try {
            // 1. 获取预签名上传链接 (Authorized Link)
            const signRes = await fetch('/api/wrap/get-upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wrapId: activeWrapId })
            });
            const signData = await signRes.json();
            if (!signData.success) throw new Error(`get-upload-url failed: ${signData.error}`);

            const { uploadUrl, ossKey } = signData;

            // 2. 将 Base64 转换为 Blob 准备直传
            const base64Content = previewImageBase64.replace(/^data:image\/\w+;base64,/, '');
            const byteCharacters = atob(base64Content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            // 3. 客户端直传 OSS (Direct PUT)
            // 该请求由浏览器直接发往阿里云，避免跨境中转超时
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/png' }
            });

            if (!uploadRes.ok) throw new Error('OSS direct upload failed');

            // 4. 通知服务器同步元数据并刷新缓存
            const confirmRes = await fetch('/api/wrap/confirm-publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wrapId: activeWrapId,
                    ossKey: ossKey
                })
            });

            const confirmData = await confirmRes.json();
            if (!confirmData.success) throw new Error(`confirm-publish failed: ${confirmData.error}`);

            alert.success(tGen('publish_success'));
            fetchHistory();
            setShowPublishModal(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            // 提高报错的可识别性，确定是哪个环节出错了
            if (message.includes('get-upload-url')) {
                alert.error(`获取授权失败: ${message}`);
            } else if (message.includes('OSS direct upload') || err instanceof TypeError) {
                // "Failed to fetch" 通常表现为 TypeError，且多发生在跨域 PUT 环节
                alert.error(`OSS上传失败 (请检查CORS配置): ${message}`);
            } else if (message.includes('confirm-publish')) {
                alert.error(`同步状态失败: ${message}`);
            } else {
                alert.error(`发布失败: ${message}`);
            }
            console.error('[Publish-Refactor] Error Stage:', err);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isLoggedInInternal) {
            const currentUrl = window.location.pathname + window.location.search
            if (typeof window !== 'undefined') {
                localStorage.setItem('auth_redirect_next', currentUrl)
            }
            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
            return
        }
        const files = e.target.files
        if (!files) return

        const remainingSlots = 5 - referenceImages.length
        const filesToProcess = Array.from(files).slice(0, remainingSlots)

        filesToProcess.forEach(file => {
            const reader = new FileReader()
            reader.onloadend = () => {
                setReferenceImages(prev => [...prev, reader.result as string])
            }
            reader.readAsDataURL(file)
        })

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removeImage = (index: number) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index))
    }

    const takeSnapshot = async () => {
        if (!viewerRef.current) return;

        try {
            // 手动拍照时不干预视角 (zoomOut: false)
            const dataUrl = await viewerRef.current.takeHighResScreenshot({ zoomOut: false });
            if (dataUrl) {
                const link = document.createElement('a');
                link.download = `myteslab-design-${selectedModel}-${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
            }
        } catch (err) {
            console.error('Snapshot failed:', err);
        }
    };

    const handleBuyCredits = () => {
        setShowPricing(true)
    }

    const handleSelectTier = (tierId: string) => {
        // TODO: Implement payment logic
        console.log('Selected tier:', tierId)
        alert.info('Payment integration coming soon!')
        setShowPricing(false)
    }

    return (
        <div className="flex flex-col h-auto lg:h-[calc(100vh-64px)] bg-[#F4F4F4] overflow-y-auto lg:overflow-hidden">
            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-visible lg:overflow-hidden w-full max-w-[1600px] mx-auto">

                {/* Left Side: 3D Preview (65%) */}
                <div className="flex-none lg:flex-[6.5] flex flex-col p-4 lg:p-6 gap-4 lg:gap-6 overflow-hidden">
                    <div className="h-[50vh] lg:flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                        <ModelViewer
                            ref={viewerRef}
                            id="ai-viewer"
                            modelUrl={getProxyUrl(models.find((m: any) => m.slug === selectedModel)?.modelUrl || '', { stable: true })}
                            textureUrl={currentTexture || undefined}
                            modelSlug={selectedModel}
                            backgroundColor={isNight ? '#1F1F1F' : '#FFFFFF'}
                            autoRotate={autoRotate}
                            className="w-full h-full"
                        />
                    </div>

                    {/* Bottom Controls for 3D */}
                    <div className="flex flex-row overflow-x-auto lg:overflow-visible flex-nowrap lg:flex-nowrap gap-1.5 lg:gap-2 pb-2 lg:pb-0">
                        <button
                            onClick={() => setIsNight(!isNight)}
                            className="px-2.5 py-2 lg:px-4 lg:py-2.5 bg-white rounded-xl shadow-sm border border-gray-200 font-medium hover:bg-gray-50 transition-all flex items-center gap-1.5 flex-shrink"
                        >
                            {isNight ? (
                                <>
                                    <Sun className="w-5 h-5 lg:w-4 lg:h-4" />
                                    <span className="hidden lg:inline">{tGen('day_mode')}</span>
                                </>
                            ) : (
                                <>
                                    <Moon className="w-5 h-5 lg:w-4 lg:h-4" />
                                    <span className="hidden lg:inline">{tGen('night_mode')}</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setAutoRotate(!autoRotate)}
                            className={`px-2.5 py-2 lg:px-4 lg:py-2.5 rounded-xl shadow-sm border font-medium transition-all flex items-center gap-1.5 flex-shrink ${autoRotate ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-700'}`}
                        >
                            {autoRotate ? (
                                <>
                                    <Pause className="w-5 h-5 lg:w-4 lg:h-4" />
                                    <span className="hidden lg:inline">{tGen('auto_rotate_on')}</span>
                                </>
                            ) : (
                                <>
                                    <RotateCw className="w-5 h-5 lg:w-4 lg:h-4" />
                                    <span className="hidden lg:inline">{tGen('auto_rotate_off')}</span>
                                </>
                            )}
                        </button>
                        <div className="hidden lg:block lg:flex-1" />
                        <button
                            onClick={takeSnapshot}
                            className="px-2.5 py-2 lg:px-4 lg:py-2.5 bg-white rounded-xl shadow-sm border border-gray-200 font-medium hover:bg-gray-50 transition-all flex items-center gap-1.5 flex-shrink"
                        >
                            <>
                                <Camera className="w-5 h-5 lg:w-4 lg:h-4" />
                                <span className="hidden lg:inline">{tGen('screenshot')}</span>
                            </>
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={!currentTexture}
                            className="px-2.5 py-2 lg:px-4 lg:py-2.5 bg-white rounded-xl shadow-sm border border-gray-200 font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink"
                        >
                            <>
                                <Download className="w-5 h-5 lg:w-4 lg:h-4" />
                                <span className="hidden lg:inline">{tGen('download_png')}</span>
                            </>
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={isPublishing || isSaving || (activeMode === 'ai' && !activeWrapId) || (activeMode === 'diy' && !currentTexture) || (activeWrapId ? history.find(h => h.id === activeWrapId)?.is_public : false)}
                            className={`px-2.5 py-2 lg:px-4 lg:py-2.5 rounded-xl shadow-sm border font-medium transition-all flex items-center gap-1.5 flex-shrink ${isPublishing || isSaving ? 'bg-gray-100' : (activeWrapId && history.find(h => h.id === activeWrapId)?.is_public ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 disabled:opacity-50')}`}
                        >
                            {(isPublishing || isSaving) ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="hidden lg:inline">{isSaving ? tGen('saving') : tGen('publishing')}</span>
                                </>
                            ) : (
                                activeWrapId && history.find(h => h.id === activeWrapId)?.is_public ? (
                                    <>
                                        <Check className="w-5 h-5 lg:w-4 lg:h-4" />
                                        <span className="hidden lg:inline">{tGen('already_published')}</span>
                                    </>
                                ) : (
                                    <>
                                        <Globe className="w-5 h-5 lg:w-4 lg:h-4" />
                                        <span className="hidden lg:inline">{tGen('publish')}</span>
                                    </>
                                )
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Side: Controls (30%) */}
                <div className="flex-none lg:flex-[3.5] flex flex-col p-4 lg:p-6 lg:pl-0 gap-4 lg:gap-6 overflow-visible lg:overflow-hidden">

                    {/* Mode Switcher Tabs */}
                    <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
                        <button
                            onClick={() => {
                                setActiveMode('ai');
                                setCurrentTexture(null);
                                setActiveWrapId(null);
                            }}
                            className={`flex-1 h-12 rounded-xl font-bold transition-all text-sm ${activeMode === 'ai' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            {tGen('mode_ai')}
                        </button>
                        <button
                            onClick={() => {
                                setActiveMode('diy');
                                setCurrentTexture(null);
                                setActiveWrapId(null);
                            }}
                            className={`flex-1 h-12 rounded-xl font-bold transition-all text-sm ${activeMode === 'diy' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            {tGen('mode_diy')}
                        </button>
                    </div>

                    {/* Conditional Panels */}
                    <div className="flex-1 overflow-hidden min-h-0">
                        {activeMode === 'ai' ? (
                            <div className="flex flex-col h-full gap-4">
                                {/* Model, Credits & Buy Area in One Row - Specific for AI */}
                                <div className="flex gap-3 items-center order-1 lg:order-2">
                                    <div className="flex-[2] relative">
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => {
                                                setSelectedModel(e.target.value)
                                                setCurrentTexture(null)
                                                setActiveWrapId(null)
                                            }}
                                            className="w-full h-14 pl-4 pr-10 bg-white border border-gray-200 rounded-xl appearance-none font-medium focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        >
                                            {models.map((m: any) => (
                                                <option key={m.slug} value={m.slug}>{m.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 w-4 h-4" />
                                    </div>

                                    <div className="flex-[3] flex gap-2 h-14 bg-white border border-gray-200 rounded-xl overflow-hidden p-1">
                                        <div className="flex-1 bg-gray-50 rounded-lg flex items-center justify-center font-bold text-gray-700 text-xs px-2 whitespace-nowrap">
                                            {isLoggedInInternal ? tGen('balance', { count: balance }) : tGen('login_to_view')}
                                        </div>
                                        <button
                                            onClick={handleBuyCredits}
                                            className="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700 transition-all text-sm whitespace-nowrap"
                                        >
                                            {tGen('buy_short')}
                                        </button>
                                    </div>
                                </div>

                                {/* Input Area */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 order-2 lg:order-3">
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder={tGen('prompt_placeholder')}
                                        className="w-full h-20 resize-none text-gray-800 focus:outline-none text-base"
                                    />

                                    {/* Reference Images Area */}
                                    <div className="border-t border-gray-100 pt-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-gray-700">
                                                {tGen('reference_images', { count: referenceImages.length })}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {tGen('reference_tip')}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {referenceImages.map((img, index) => (
                                                <div key={index} className="relative w-12 h-12 group">
                                                    <Image
                                                        src={img}
                                                        alt="reference"
                                                        width={48}
                                                        height={48}
                                                        className="w-full h-full object-cover rounded-lg border border-gray-100"
                                                    />
                                                    <button
                                                        onClick={() => removeImage(index)}
                                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}

                                            {referenceImages.length < 5 && (
                                                <button
                                                    onClick={() => {
                                                        if (!isLoggedInInternal) {
                                                            const currentUrl = window.location.pathname + window.location.search
                                                            if (typeof window !== 'undefined') {
                                                                localStorage.setItem('auth_redirect_next', currentUrl)
                                                            }
                                                            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
                                                            return
                                                        }
                                                        fileInputRef.current?.click()
                                                    }}
                                                    className="w-12 h-12 border-2 border-dashed border-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all bg-gray-50/50"
                                                >
                                                    <Plus className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />
                                                    <span className="text-[10px] font-bold mt-1 whitespace-nowrap text-gray-400 group-hover:text-blue-500">{tGen('upload_reference')}</span>
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageUpload}
                                        />
                                    </div>

                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating || !prompt.trim()}
                                        className={`w-full h-14 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isGenerating ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-black text-white hover:bg-zinc-800 active:scale-95'}`}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                {tGen('generating')}
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                {tGen('generate_btn')}
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* History List */}
                                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden order-3 lg:order-1 min-h-[400px] lg:min-h-0">
                                    <div className="p-4 border-b border-gray-100 font-bold text-gray-800 flex justify-between items-center">
                                        {tGen('history')}
                                        <button onClick={fetchHistory} className="text-xs text-blue-500 font-normal">{tGen('refresh')}</button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
                                        {isFetchingHistory && history.length === 0 ? (
                                            [1, 2, 3].map(i => (
                                                <div key={i} className="flex gap-3 p-3 rounded-xl border border-gray-100 animate-pulse">
                                                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0" />
                                                    <div className="flex-1 space-y-2 py-1">
                                                        <div className="h-2 bg-gray-100 rounded w-3/4" />
                                                        <div className="h-2 bg-gray-100 rounded w-1/2" />
                                                        <div className="flex justify-between pt-2">
                                                            <div className="h-2 bg-gray-50 rounded w-1/4" />
                                                            <div className="h-2 bg-gray-50 rounded w-1/4" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : history.length === 0 ? (
                                            <div className="h-[200px] flex flex-col items-center justify-center text-gray-400 text-sm">
                                                <Palette className="w-12 h-12 mb-4 text-gray-300" />
                                                {tGen('no_history')}
                                            </div>
                                        ) : (
                                            <>
                                                {isFetchingHistory && (
                                                    <div className="absolute top-0 left-0 right-0 h-[1px] overflow-hidden z-10 pointer-events-none">
                                                        <div className="w-1/2 h-full bg-blue-600 animate-[loading_1s_infinite_linear]"
                                                            style={{ backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(to right, transparent, #3b82f6, transparent)' }} />
                                                    </div>
                                                )}
                                                {history.map((item) => (
                                                    <HistoryItem
                                                        key={item.id}
                                                        item={item}
                                                        activeWrapId={activeWrapId}
                                                        getCdnUrl={getCdnUrl}
                                                        onClick={() => {
                                                            const itemCdnUrl = getCdnUrl(item.texture_url);
                                                            let displayUrl = itemCdnUrl;
                                                            if (itemCdnUrl && itemCdnUrl.startsWith('http') && !itemCdnUrl.includes(window.location.origin)) {
                                                                displayUrl = `/api/proxy?url=${encodeURIComponent(itemCdnUrl)}`;
                                                            }
                                                            setCurrentTexture(displayUrl);
                                                            setSelectedModel(item.model_slug);
                                                            setActiveWrapId(item.id);
                                                        }}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col gap-4 overflow-hidden">
                                {/* Model Select for DIY */}
                                <div className="relative">
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full h-14 pl-4 pr-10 bg-white border border-gray-200 rounded-xl appearance-none font-medium focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    >
                                        {models.map((m: any) => (
                                            <option key={m.slug} value={m.slug}>{m.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 w-4 h-4" />
                                </div>

                                <div className="flex-1 overflow-y-auto pr-1">
                                    <StickerEditor
                                        modelSlug={selectedModel}
                                        onTextureUpdate={(url) => setCurrentTexture(url)}
                                        onSave={handleSaveDiy}
                                        isSaving={isSaving}
                                        isLoggedIn={isLoggedInInternal}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <PricingModal
                isOpen={showPricing}
                onClose={() => setShowPricing(false)}
                onSelectTier={handleSelectTier}
            />

            <PublishModal
                isOpen={showPublishModal}
                onClose={() => setShowPublishModal(false)}
                onConfirm={confirmPublish}
                modelSlug={selectedModel}
                modelUrl={getProxyUrl(models.find(m => m.slug === selectedModel)?.modelUrl || '', { stable: true })}
                textureUrl={currentTexture || ''}
                isPublishing={isPublishing}
            />
        </div>
    );
}

function HistoryItem({
    item,
    activeWrapId,
    onClick,
    getCdnUrl
}: {
    item: GenerationHistory;
    activeWrapId: string | null;
    onClick: () => void;
    getCdnUrl: (url: string) => string;
}) {
    const textureUrl = item.texture_url || '';

    return (
        <div
            onClick={onClick}
            className={`flex gap-3 p-3 rounded-xl border transition-all group cursor-pointer ${activeWrapId === item.id ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'}`}
        >
            <div
                className="w-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0"
                style={{ aspectRatio: '4 / 3' }}
            >
                <ResponsiveOSSImage
                    src={textureUrl}
                    alt="wrap"
                    width={64}
                    height={48} // 64 / (4/3) = 48
                    className="w-full h-full object-cover"
                />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                    <p className="text-xs text-gray-600 line-clamp-1 italic flex-1">&quot;{item.prompt}&quot;</p>
                    {item.is_public && (
                        <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[8px] font-bold rounded uppercase">
                            Public
                        </span>
                    )}
                </div>
                <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-gray-400 uppercase">{item.model_slug}</span>
                    <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 flex items-center gap-1">
                        Apply <ArrowRight className="w-3 h-3" />
                    </span>
                </div>
            </div>
        </div>
    );
}
