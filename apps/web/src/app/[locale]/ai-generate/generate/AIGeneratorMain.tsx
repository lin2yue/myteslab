'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import { Link } from '@/i18n/routing'
import { createClient } from '@/utils/supabase/client'
import { flipImage180, rotateImage } from '@/lib/utils/image-utils'

interface Task {
    id: string
    prompt: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    created_at: string
}

interface GenerationHistory {
    id: string
    prompt: string
    preview_url: string
    texture_url: string
    model_slug: string
    is_public: boolean
}

export default function AIGeneratorMain({
    initialCredits,
    models,
    locale
}: {
    initialCredits: number,
    models: any[],
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
    const [isGenerating, setIsGenerating] = useState(false)
    const [history, setHistory] = useState<GenerationHistory[]>([])
    const [currentTexture, setCurrentTexture] = useState<string | null>(null)
    const [activeWrapId, setActiveWrapId] = useState<string | null>(null)
    const [isPublishing, setIsPublishing] = useState(false)

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
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                console.log('fetchHistory: No user found')
                return
            }

            const { data, error } = await supabase
                .from('generated_wraps')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10)

            if (error) throw error
            if (data) setHistory(data)
        } catch (err: any) {
            console.error('Fetch history error:', err)
        } finally {
            isFetchingRef.current = false
            setIsFetchingHistory(false)
        }
    }, [supabase])

    useEffect(() => {
        let isMounted = true
        if (isMounted) {
            console.log('AIGeneratorMain: Running initial fetchHistory')
            fetchHistory()
        }

        // 监听登录状态变化，确保登录瞬间能刷出历史记录
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (isMounted && session?.user) {
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
                    prompt: prompt.trim()
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

        } catch (err: any) {
            alert(`生成失败: ${err.message}`)
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
    const handlePublish = async () => {
        if (!activeWrapId || !viewerRef.current) return;

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
                    wrapId: activeWrapId,
                    imageBase64: previewImageBase64
                })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            alert(tGen('publish_success'));
            // 刷新历史
            fetchHistory();
        } catch (err: any) {
            alert(`发布失败: ${err.message}`);
        } finally {
            setIsPublishing(false);
        }
    };

    const takeSnapshot = () => {
        // 实现 3D 截图功能
        const viewer = document.getElementById('ai-viewer') as any
        if (viewer) {
            const url = viewer.toDataURL()
            const link = document.createElement('a')
            link.download = `myteslab-design-${selectedModel}.png`
            link.href = url
            link.click()
        }
    }

    return (
        <div className="flex flex-col h-screen bg-[#F4F4F4] overflow-hidden">
            {/* Top Navigation */}
            <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <h1 className="text-xl font-bold text-gray-900">{tGen('title')}</h1>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                        {tGen('nav_back')}
                    </Link>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">

                {/* Left Side: 3D Preview (70%) */}
                <div className="flex-[7] flex flex-col p-6 gap-6 overflow-hidden">
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                        <ModelViewer
                            ref={viewerRef}
                            id="ai-viewer"
                            modelUrl={models.find(m => m.slug === selectedModel)?.modelUrl || ''}
                            textureUrl={currentTexture || undefined}
                            modelSlug={selectedModel}
                            environment={isNight ? 'neutral' : 'neutral'}
                            autoRotate={autoRotate}
                            className="w-full h-full"
                        />
                        <div className="absolute top-4 left-4 bg-white/50 backdrop-filter blur-md px-4 py-2 rounded-full text-sm font-medium text-gray-800">
                            {models.find(m => m.slug === selectedModel)?.name} - 3D 预览
                        </div>
                    </div>

                    {/* Bottom Controls for 3D */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setIsNight(!isNight)}
                            className="px-6 py-3 bg-white rounded-xl shadow-sm border border-gray-200 font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                            {isNight ? tGen('night_mode') : tGen('day_mode')}
                        </button>
                        <button
                            onClick={() => setAutoRotate(!autoRotate)}
                            className={`px-6 py-3 rounded-xl shadow-sm border font-medium transition-colors flex items-center gap-2 ${autoRotate ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-700'}`}
                        >
                            {autoRotate ? tGen('auto_rotate_on') : tGen('auto_rotate_off')}
                        </button>
                        <div className="flex-1" />
                        <button
                            onClick={takeSnapshot}
                            className="px-6 py-3 bg-white rounded-xl shadow-sm border border-gray-200 font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                            {tGen('screenshot')}
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={!currentTexture}
                            className="px-6 py-3 bg-white rounded-xl shadow-sm border border-gray-200 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {tGen('download_png')}
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={!activeWrapId || isPublishing || history.find(h => h.id === activeWrapId)?.is_public}
                            className={`px-6 py-3 rounded-xl shadow-sm border font-medium transition-colors flex items-center gap-2 ${isPublishing ? 'bg-gray-100' : (history.find(h => h.id === activeWrapId)?.is_public ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 disabled:opacity-50')}`}
                        >
                            {isPublishing ? '...' : (history.find(h => h.id === activeWrapId)?.is_public ? tGen('already_published') : tGen('publish'))}
                        </button>
                    </div>
                </div>

                {/* Right Side: Controls (30%) */}
                <div className="flex-[3] flex flex-col p-6 pl-0 gap-6 overflow-hidden">

                    {/* History List */}
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-100 font-bold text-gray-800 flex justify-between items-center">
                            {tGen('history')}
                            <button onClick={fetchHistory} className="text-xs text-blue-500 font-normal">{tGen('refresh')}</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {isFetchingHistory && history.length === 0 ? (
                                // 加载骨架屏
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
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                                    <span className="text-4xl mb-4">🎨</span>
                                    {tGen('no_history')}
                                </div>
                            ) : (
                                <>
                                    {isFetchingHistory && (
                                        <div className="absolute top-12 left-0 right-0 h-0.5 bg-blue-100 overflow-hidden z-10">
                                            <div className="w-1/2 h-full bg-blue-500 animate-[loading_1s_infinite_linear]"
                                                style={{ backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(to right, transparent, #3b82f6, transparent)' }} />
                                        </div>
                                    )}
                                    {history.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={async () => {
                                                const cdnUrl = getCdnUrl(item.texture_url);
                                                // 自动处理 CORS：如果是远程 URL，且非同源，则通过代理加载
                                                let displayUrl = cdnUrl;
                                                if (cdnUrl.startsWith('http') && !cdnUrl.includes(window.location.origin)) {
                                                    displayUrl = `/api/proxy?url=${encodeURIComponent(cdnUrl)}`;
                                                }

                                                console.log('Applying texture from history:', { original: item.texture_url, cdn: cdnUrl, display: displayUrl });

                                                setCurrentTexture(displayUrl);
                                                setSelectedModel(item.model_slug);
                                                setActiveWrapId(item.id);
                                            }}
                                            className={`flex gap-3 p-3 rounded-xl border transition-all group cursor-pointer ${activeWrapId === item.id ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'}`}
                                        >
                                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                                <img
                                                    src={getCdnUrl(item.texture_url)}
                                                    alt="wrap"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        console.error('Failed to load history image:', item.texture_url);
                                                        e.currentTarget.src = 'https://placehold.co/100x100?text=Error'; // Fallback
                                                    }}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-xs text-gray-600 line-clamp-1 italic flex-1">"{item.prompt}"</p>
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
                                    ))}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Model, Credits & Buy Area in One Row */}
                    <div className="flex gap-3 items-center">
                        <div className="flex-[2] relative">
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
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={tGen('prompt_placeholder')}
                            className="w-full h-32 resize-none text-gray-800 focus:outline-none text-lg"
                        />
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

                </div>
            </div>
        </div>
    )


}
