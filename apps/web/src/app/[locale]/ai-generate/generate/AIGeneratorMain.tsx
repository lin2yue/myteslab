'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import { Link } from '@/i18n/routing'
import { createClient } from '@/utils/supabase/client'
import Image from 'next/image'
import StickerEditor from '@/components/sticker/StickerEditor'

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
    locale: _locale
}: {
    initialCredits: number,
    models: Array<{ slug: string; name: string; modelUrl?: string }>,

    locale: string
}) {
    const t = useTranslations('Common')
    const tIndex = useTranslations('Index')
    const tGen = useTranslations('Generator')
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

    // 3D 控制状态
    const [isNight, setIsNight] = useState(false)
    const [autoRotate, setAutoRotate] = useState(true)
    const viewerRef = useRef<ModelViewerRef>(null)
    const isFetchingRef = useRef(false)


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
                return
            }

            let query = supabase
                .from('wraps')
                .select('*')
                .eq('user_id', user.id)
                .is('deleted_at', null)

            // Adjust filter based on active mode
            if (activeMode === 'diy') {
                query = query.eq('category', 'diy')
            } else {
                query = query.or('category.neq.diy,category.is.null')
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(10)

            if (error) throw error
            if (data) setHistory(data)
        } catch (err) {
            console.error('Fetch history error:', err)
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
            if (isMounted && session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
                fetchHistory()
            }
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [fetchHistory, supabase])

    // 生成逻辑
    const handleGenerate = async () => {
        if (!prompt.trim() || isGenerating) return
        if (balance <= 0) {
            alert('积分不足，请先购买生成包')
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
            alert(`生成失败: ${message}`)
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
            alert('保存失败：' + (err instanceof Error ? err.message : String(err)));
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!viewerRef.current) return;

        // Automatically save if not yet saved in DIY mode
        let wrapIdToPublish = activeWrapId;
        if (!wrapIdToPublish && activeMode === 'diy' && currentTexture) {
            wrapIdToPublish = await handleSaveDiy(currentTexture);
        }

        if (!wrapIdToPublish) return;

        setIsPublishing(true);
        try {
            // 0. 检查客户端登录状态
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.error('No session found on client before publish');
                throw new Error('Please login again');
            }

            // 1. 捕捉高分辨率 3D 预览图
            const previewImageBase64 = await viewerRef.current.takeHighResScreenshot();

            if (!previewImageBase64) {
                throw new Error('Failed to capture 3D preview');
            }

            // 2. 调用上传并发布接口
            const res = await fetch('/api/wrap/upload-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wrapId: wrapIdToPublish,
                    imageBase64: previewImageBase64
                })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            alert(tGen('publish_success'));
            // 刷新历史
            fetchHistory();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            alert(`发布失败: ${message}`);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const takeSnapshot = () => {
        // 实现 3D 截图功能
        const viewer = document.getElementById('ai-viewer')
        if (viewer && 'toDataURL' in viewer && typeof (viewer as { toDataURL: () => string }).toDataURL === 'function') {
            const url = (viewer as { toDataURL: () => string }).toDataURL()
            const link = document.createElement('a')
            link.download = `myteslab-design-${selectedModel}.png`
            link.href = url
        }
    }

    const splitLabel = (label: string) => {
        const parts = label.split(' ')
        if (parts.length > 1) {
            return { icon: parts[0], text: parts.slice(1).join(' ') }
        }
        return { icon: '', text: label }
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
                            modelUrl={models.find(m => m.slug === selectedModel)?.modelUrl || ''}
                            textureUrl={currentTexture || undefined}
                            modelSlug={selectedModel}
                            backgroundColor={isNight ? '#1F1F1F' : '#FFFFFF'}
                            autoRotate={autoRotate}
                            ignoreConfigRotation={activeMode === 'diy'}
                            className="w-full h-full"
                        />
                    </div>

                    {/* Bottom Controls for 3D */}
                    <div className="flex flex-row overflow-x-auto flex-nowrap lg:flex-wrap gap-2 lg:gap-3 pb-2 lg:pb-0">
                        <button
                            onClick={() => setIsNight(!isNight)}
                            className="px-3 py-2 lg:px-6 lg:py-3 bg-white rounded-xl shadow-sm border border-gray-200 font-medium hover:bg-gray-50 transition-all flex items-center gap-2 flex-shrink-0"
                        >
                            {(() => {
                                const { icon, text } = splitLabel(isNight ? tGen('day_mode') : tGen('night_mode'))
                                return <><span className="text-lg lg:text-base">{icon}</span><span className="hidden lg:inline">{text}</span></>
                            })()}
                        </button>
                        <button
                            onClick={() => setAutoRotate(!autoRotate)}
                            className={`px-3 py-2 lg:px-6 lg:py-3 rounded-xl shadow-sm border font-medium transition-all flex items-center gap-2 flex-shrink-0 ${autoRotate ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-700'}`}
                        >
                            {(() => {
                                const { icon, text } = splitLabel(autoRotate ? tGen('auto_rotate_on') : tGen('auto_rotate_off'))
                                return <><span className="text-lg lg:text-base">{icon}</span><span className="hidden lg:inline">{text}</span></>
                            })()}
                        </button>
                        <div className="hidden lg:block lg:flex-1" />
                        <button
                            onClick={takeSnapshot}
                            className="px-3 py-2 lg:px-6 lg:py-3 bg-white rounded-xl shadow-sm border border-gray-200 font-medium hover:bg-gray-50 transition-all flex items-center gap-2 flex-shrink-0"
                        >
                            {(() => {
                                const { icon, text } = splitLabel(tGen('screenshot'))
                                return <><span className="text-lg lg:text-base">{icon}</span><span className="hidden lg:inline">{text}</span></>
                            })()}
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={!currentTexture}
                            className="px-3 py-2 lg:px-6 lg:py-3 bg-white rounded-xl shadow-sm border border-gray-200 font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                        >
                            {(() => {
                                const { icon, text } = splitLabel(tGen('download_png'))
                                return <><span className="text-lg lg:text-base">{icon}</span><span className="hidden lg:inline">{text}</span></>
                            })()}
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={isPublishing || isSaving || (activeMode === 'ai' && !activeWrapId) || (activeMode === 'diy' && !currentTexture) || (activeWrapId ? history.find(h => h.id === activeWrapId)?.is_public : false)}
                            className={`px-3 py-2 lg:px-6 lg:py-3 rounded-xl shadow-sm border font-medium transition-all flex items-center gap-2 flex-shrink-0 ${isPublishing || isSaving ? 'bg-gray-100' : (activeWrapId && history.find(h => h.id === activeWrapId)?.is_public ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 disabled:opacity-50')}`}
                        >
                            {(isPublishing || isSaving) ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="hidden lg:inline">{isSaving ? '正在保存...' : '正在发布...'}</span>
                                </>
                            ) : (() => {
                                const { icon, text } = splitLabel(activeWrapId && history.find(h => h.id === activeWrapId)?.is_public ? tGen('already_published') : tGen('publish'))
                                return <><span className="text-lg lg:text-base">{icon}</span><span className="hidden lg:inline">{text}</span></>
                            })()}
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
                                            {models.map(m => (
                                                <option key={m.slug} value={m.slug}>{m.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                                    </div>

                                    <div className="flex-[3] flex gap-2 h-14 bg-white border border-gray-200 rounded-xl overflow-hidden p-1">
                                        <div className="flex-1 bg-gray-50 rounded-lg flex items-center justify-center font-bold text-gray-700 text-xs px-2 whitespace-nowrap">
                                            {tGen('balance', { count: balance })}
                                        </div>
                                        <button className="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700 transition-all text-sm whitespace-nowrap">
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
                                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] opacity-100 shadow-sm"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}

                                            {referenceImages.length < 5 && (
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-12 h-12 border-2 border-dashed border-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all bg-gray-50/50"
                                                >
                                                    <span className="text-lg leading-none">+</span>
                                                    <span className="text-[8px] font-bold mt-0.5 whitespace-nowrap">{tGen('upload_reference')}</span>
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
                                                <div className="w-5 h-5 border-2 border-zinc-400 border-t-white rounded-full animate-spin"></div>
                                                {tGen('generating')}
                                            </>
                                        ) : tGen('generate_btn')}
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
                                                <span className="text-4xl mb-4">🎨</span>
                                                {tGen('no_history')}
                                            </div>
                                        ) : (
                                            <>
                                                {isFetchingHistory && (
                                                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-100 overflow-hidden z-10">
                                                        <div className="w-1/2 h-full bg-blue-500 animate-[loading_1s_infinite_linear]"
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
                                                            const cdnUrl = getCdnUrl(item.texture_url);
                                                            let displayUrl = cdnUrl;
                                                            if (cdnUrl.startsWith('http') && !cdnUrl.includes(window.location.origin)) {
                                                                displayUrl = `/api/proxy?url=${encodeURIComponent(cdnUrl)}`;
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
                                        {models.map(m => (
                                            <option key={m.slug} value={m.slug}>{m.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-1">
                                    <StickerEditor
                                        modelSlug={selectedModel}
                                        onTextureUpdate={(url) => setCurrentTexture(url)}
                                        onSave={handleSaveDiy}
                                        isSaving={isSaving}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
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
    const [imgSrc, setImgSrc] = useState(getCdnUrl(item.texture_url));

    return (
        <div
            onClick={onClick}
            className={`flex gap-3 p-3 rounded-xl border transition-all group cursor-pointer ${activeWrapId === item.id ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'}`}
        >
            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                <Image
                    src={imgSrc}
                    alt="wrap"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    onError={() => {
                        console.error('Failed to load history image:', item.texture_url);
                        setImgSrc('https://placehold.co/100x100?text=Error'); // Fallback
                    }}
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
                    <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100">Apply →</span>
                </div>
            </div>
        </div>
    );
}
