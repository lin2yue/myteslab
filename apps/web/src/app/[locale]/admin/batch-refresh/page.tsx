'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import { createClient } from '@/utils/supabase/client'
import { useTranslations } from 'next-intl'
import { Loader2, CheckCircle2, AlertCircle, Play, Pause, RefreshCw, CheckSquare, Square, Eye } from 'lucide-react'
import { useAlert } from '@/components/alert/AlertProvider'
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage'

interface WrapRecord {
    id: string
    model_slug: string
    texture_url: string
    preview_url: string
    name: string
    created_at: string
}

interface ModelConfig {
    slug: string
    model_3d_url: string
}

export default function BatchRefreshPage() {
    const t = useTranslations('Common')
    const alert = useAlert()
    const supabase = createClient()
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'

    const [wraps, setWraps] = useState<WrapRecord[]>([])
    const [models, setModels] = useState<ModelConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [currentIndex, setCurrentIndex] = useState(-1)
    const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle')
    const [logs, setLogs] = useState<Record<string, { status: 'pending' | 'success' | 'error', message?: string }>>({})
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const viewerRef = useRef<ModelViewerRef>(null)
    const [activeWrap, setActiveWrap] = useState<WrapRecord | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [zoomImage, setZoomImage] = useState<string | null>(null)

    // Standard View Configuration constants for UI sync

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

    // Load data
    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                // 1. Fetch Models mapping
                const { data: modelsData } = await supabase.from('wrap_models').select('slug, model_3d_url')
                setModels(modelsData || [])

                // 2. Fetch All Wraps (not just current user's)
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    alert.warning('Please login first')
                    return
                }

                // Fetch all wraps from all users for admin batch refresh
                const { data: wrapsData } = await supabase
                    .from('wraps')
                    .select('id, model_slug, texture_url, preview_url, name, created_at, user_id')
                    .is('deleted_at', null) // Avoid duplicates from deleted records
                    .order('created_at', { ascending: false })

                // Filter out wraps with local debug paths (they won't load in production)
                const validWraps = (wrapsData || []).filter(wrap => {
                    const hasLocalTexture = wrap.texture_url?.includes('/api/debug/assets')
                    const hasLocalPreview = wrap.preview_url?.includes('/api/debug/assets')
                    const hasBase64Texture = wrap.texture_url?.startsWith('data:image/')
                    const hasBase64Preview = wrap.preview_url?.startsWith('data:image/')

                    if (hasLocalTexture || hasLocalPreview || hasBase64Texture || hasBase64Preview) {
                        console.warn(`Skipping wrap ${wrap.id} (${wrap.name}) - invalid URL format`)
                        return false
                    }
                    return true
                })

                // Simple de-duplication by id just in case
                const uniqueWraps = Array.from(new Map(validWraps.map(item => [item.id, item])).values())

                console.log(`Loaded ${uniqueWraps.length} valid wraps (filtered out ${(wrapsData?.length || 0) - uniqueWraps.length} local wraps)`)

                setWraps(uniqueWraps)
                setSelectedIds(new Set(uniqueWraps.map(w => w.id)))

                const initialLogs: Record<string, { status: 'pending' }> = {}
                uniqueWraps.forEach(w => { initialLogs[w.id] = { status: 'pending' } })
                setLogs(initialLogs)

                if (uniqueWraps.length > 0) setActiveWrap(uniqueWraps[0])
            } catch (err) {
                console.error('Fetch failed:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const selectedWraps = useMemo(() => {
        return wraps.filter(w => selectedIds.has(w.id))
    }, [wraps, selectedIds])

    const processNext = useCallback(async () => {
        if (status !== 'running' || isProcessing) return

        const nextIndex = currentIndex + 1
        if (nextIndex >= selectedWraps.length) {
            setStatus('completed')
            return
        }

        setIsProcessing(true)
        setCurrentIndex(nextIndex)
        const wrap = selectedWraps[nextIndex]
        setActiveWrap(wrap)

        try {
            // Wait for ModelViewer to load (model + texture) precisely
            if (!viewerRef.current) throw new Error('Viewer not ready')

            const isReady = await viewerRef.current.waitForReady(15000) // 15s timeout
            if (!isReady) console.warn('Viewer readiness timed out, taking screenshot anyway')

            // Extra buffer to ensure model is fully rendered on screen
            await new Promise(resolve => setTimeout(resolve, 500))

            const imageBase64 = await viewerRef.current.takeHighResScreenshot({ useStandardView: true })
            if (!imageBase64) throw new Error('Screenshot failed')

            // 1. 获取预签名链接
            const signRes = await fetch('/api/wrap/get-upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wrapId: wrap.id })
            })
            const signData = await signRes.json()
            if (!signData.success) throw new Error(`授权失败: ${signData.error}`)

            const { uploadUrl, ossKey } = signData

            // 2. 转换 Blob 并直传
            const base64Content = imageBase64.replace(/^data:image\/\w+;base64,/, '')
            const byteCharacters = atob(base64Content)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' })

            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/png' }
            })
            if (!uploadRes.ok) throw new Error('OSS直传失败 (可能需检查CORS)')

            // 3. 通知服务器确认
            const confirmRes = await fetch('/api/wrap/confirm-publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wrapId: wrap.id,
                    ossKey: ossKey
                })
            })

            const confirmData = await confirmRes.json()
            if (!confirmData.success) throw new Error(`确认发布失败: ${confirmData.error}`)

            // Update local state
            const newPreviewUrl = confirmData.previewUrl
            setWraps(prev => prev.map(w => w.id === wrap.id ? { ...w, preview_url: newPreviewUrl } : w))
            setActiveWrap(prev => prev && prev.id === wrap.id ? { ...prev, preview_url: newPreviewUrl } : prev)

            setLogs(prev => ({ ...prev, [wrap.id]: { status: 'success' } }))
        } catch (err) {
            console.error(`Error processing ${wrap.id}:`, err)
            setLogs(prev => ({ ...prev, [wrap.id]: { status: 'error', message: String(err) } }))
        } finally {
            setIsProcessing(false)
        }
    }, [status, currentIndex, selectedWraps, isProcessing])

    useEffect(() => {
        if (status === 'running' && !isProcessing) {
            processNext()
        }
    }, [status, isProcessing, processNext])

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) newSelected.delete(id)
        else newSelected.add(id)
        setSelectedIds(newSelected)
    }

    const toggleAll = () => {
        if (selectedIds.size === wraps.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(wraps.map(w => w.id)))
    }

    if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin inline mr-2" /> Loading wraps...</div>

    const getModelUrl = (slug: string) => {
        return models.find(m => m.slug === slug)?.model_3d_url || ''
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 p-8 overflow-hidden">
            {/* Image Zoom Modal */}
            {zoomImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-10 cursor-zoom-out"
                    onClick={() => setZoomImage(null)}
                >
                    <div className="relative max-w-full max-h-full aspect-[4/3] bg-[#1F1F1F] rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                        <img src={zoomImage} alt="Zoomed" className="w-full h-full object-contain" />
                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            Standard Quality Preview (1024x768)
                        </div>
                        <button
                            className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
                            onClick={() => setZoomImage(null)}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Batch Refresh AI Previews v2</h1>
                    <p className="text-gray-500">Unify existing wraps to Standard View (225° Dark)</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={toggleAll}
                        className="bg-white border border-gray-200 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-50"
                    >
                        {selectedIds.size === wraps.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {status === 'idle' || status === 'paused' ? (
                        <button
                            onClick={() => {
                                if (selectedWraps.length === 0) {
                                    alert.warning('Select items first')
                                    return
                                }
                                setStatus('running')
                            }}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                            disabled={selectedWraps.length === 0}
                        >
                            <Play size={18} /> {status === 'idle' ? `Start Batch (${selectedWraps.length})` : 'Resume'}
                        </button>
                    ) : status === 'running' ? (
                        <button
                            onClick={() => setStatus('paused')}
                            className="bg-gray-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-700"
                        >
                            <Pause size={18} /> Pause
                        </button>
                    ) : (
                        <button
                            onClick={() => { setCurrentIndex(-1); setStatus('idle'); }}
                            className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700"
                        >
                            <RefreshCw size={18} /> Reset
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-8 flex-1 overflow-hidden">
                {/* Left side: Preview Window */}
                <div className="flex-[1.5] flex flex-col gap-4 overflow-hidden">
                    <div
                        className="bg-black rounded-2xl overflow-hidden relative border-4 border-gray-200 shadow-xl"
                        style={{ aspectRatio: '4 / 3' }}
                    >
                        {activeWrap ? (
                            <ModelViewer
                                ref={viewerRef}
                                modelUrl={`/api/proxy?url=${encodeURIComponent(getModelUrl(activeWrap.model_slug))}`}
                                textureUrl={`/api/proxy?url=${encodeURIComponent(activeWrap.texture_url)}`}
                                modelSlug={activeWrap.model_slug}
                                backgroundColor="#1F1F1F"
                                autoRotate={false}
                                className="w-full h-full"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 italic">
                                Select a wrap to preview...
                            </div>
                        )}

                        {isProcessing && (
                            <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold animate-pulse z-30">
                                Processing Item {currentIndex + 1} / {selectedWraps.length}
                            </div>
                        )}
                    </div>

                    {activeWrap && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-900">{activeWrap.name || 'Untitled'}</h3>
                                <p className="text-xs text-gray-400 font-mono">{activeWrap.id}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400">Current Preview:</span>
                                <div
                                    className="w-20 bg-gray-100 rounded border border-gray-100 overflow-hidden cursor-zoom-in hover:border-blue-400 transition-colors relative"
                                    style={{ aspectRatio: '4 / 3' }}
                                    onClick={() => setZoomImage(getCdnUrl(activeWrap.preview_url))}
                                >
                                    <ResponsiveOSSImage
                                        src={activeWrap.preview_url}
                                        alt="curr"
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right side: Selection List & Logs */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <span className="font-bold">Item List & Status</span>
                        <span className="text-sm font-mono">{currentIndex + 1} / {selectedWraps.length} Selected</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {wraps.map((wrap, i) => {
                            const isCurrent = activeWrap?.id === wrap.id;
                            const isProcessingItem = status === 'running' && selectedWraps[currentIndex]?.id === wrap.id;
                            const log = logs[wrap.id];

                            return (
                                <div
                                    key={wrap.id}
                                    className={`group flex items-center gap-3 p-3 border-b border-gray-50 transition-colors ${isCurrent ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                                >
                                    <button
                                        onClick={() => toggleSelect(wrap.id)}
                                        className="text-gray-400 hover:text-blue-600 transition-colors"
                                        disabled={status === 'running'}
                                    >
                                        {selectedIds.has(wrap.id) ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                                    </button>

                                    <div
                                        className="w-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-100 cursor-zoom-in hover:border-blue-400 transition-colors relative"
                                        style={{ aspectRatio: '4 / 3' }}
                                        onClick={(e) => { e.stopPropagation(); setZoomImage(getCdnUrl(wrap.preview_url)); }}
                                    >
                                        <ResponsiveOSSImage
                                            src={wrap.preview_url}
                                            alt=""
                                            fill
                                            className="object-cover"
                                        />
                                    </div>

                                    <div className="flex-1 min-w-0" onClick={() => status !== 'running' && setActiveWrap(wrap)}>
                                        <p className="font-medium text-sm truncate">{wrap.name || 'Untitled'}</p>
                                        <p className="text-[10px] text-gray-400 font-mono truncate">{wrap.model_slug}</p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {log?.status === 'success' && <CheckCircle2 className="text-green-500" size={16} />}
                                        {log?.status === 'error' && <AlertCircle className="text-red-500" size={16} />}
                                        {isProcessingItem && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent animate-spin rounded-full" />}
                                        <button
                                            onClick={() => setActiveWrap(wrap)}
                                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white rounded-lg transition-all"
                                        >
                                            <Eye size={16} className="text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
