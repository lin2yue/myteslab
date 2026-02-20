'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
    AlertCircle,
    CheckCircle2,
    CheckSquare,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    Loader2,
    Play,
    Search,
    Square,
    ZoomIn
} from 'lucide-react'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import { useAlert } from '@/components/alert/AlertProvider'
import { useLocale } from '@/lib/i18n'
import { createModelNameResolver } from '@/lib/model-display'
import { revalidateWraps } from '@/app/actions/revalidate'

interface WrapRecord {
    id: string
    slug?: string | null
    name: string
    model_slug: string
    category: string
    preview_url: string
    texture_url: string
    prompt?: string | null
    reference_images?: string[] | null
    browse_count?: number | null
    download_count?: number | null
    is_active: boolean
    is_public: boolean
    created_at: string
    updated_at?: string
    profiles: {
        display_name?: string | null
        email?: string | null
        avatar_url?: string | null
    } | null
}

interface ModelConfig {
    slug: string
    name: string
    name_en?: string
    model_3d_url: string
    wheel_url?: string
}

type BatchItemStatus = 'pending' | 'processing' | 'success' | 'error'

export default function AdminWrapsPage() {
    const alert = useAlert()
    const locale = useLocale()
    const viewerRef = useRef<ModelViewerRef>(null)
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'

    const [wraps, setWraps] = useState<WrapRecord[]>([])
    const [models, setModels] = useState<ModelConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('all')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [activeWrapId, setActiveWrapId] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [hasMore, setHasMore] = useState(false)
    const [showPreviewPanel, setShowPreviewPanel] = useState(true)
    const [zoomImage, setZoomImage] = useState<string | null>(null)

    const [batchStatus, setBatchStatus] = useState<'idle' | 'running' | 'completed'>('idle')
    const [isProcessing, setIsProcessing] = useState(false)
    const [batchQueueIds, setBatchQueueIds] = useState<string[]>([])
    const [batchIndex, setBatchIndex] = useState(-1)
    const [batchLogs, setBatchLogs] = useState<Record<string, { status: BatchItemStatus; message?: string }>>({})

    const pageSize = 50
    const getModelName = useMemo(() => createModelNameResolver(models, locale), [models, locale])

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
            setPage(1)
        }, 400)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const wrapMap = useMemo(() => new Map(wraps.map((item) => [item.id, item])), [wraps])
    const activeWrap = useMemo(() => (activeWrapId ? wrapMap.get(activeWrapId) || null : null), [activeWrapId, wrapMap])
    const selectedWraps = useMemo(() => wraps.filter((item) => selectedIds.has(item.id)), [wraps, selectedIds])

    const getCdnUrl = useCallback((url: string) => {
        if (url && url.includes('aliyuncs.com')) {
            try {
                const urlObj = new URL(url)
                return `${cdnUrl}${urlObj.pathname}${urlObj.search}`
            } catch {
                return url
            }
        }
        return url
    }, [cdnUrl])

    const toViewerAssetUrl = useCallback((url?: string) => {
        if (!url) return undefined
        const normalized = getCdnUrl(url)
        if (!normalized.startsWith('http')) return normalized
        if (normalized.includes('cdn.tewan.club')) return normalized
        return `/api/proxy?url=${encodeURIComponent(normalized)}`
    }, [getCdnUrl])

    const getModelUrl = useCallback((slug: string) => models.find((item) => item.slug === slug)?.model_3d_url || '', [models])
    const getModelWheelUrl = useCallback((slug: string) => models.find((item) => item.slug === slug)?.wheel_url || '', [models])

    const fetchWraps = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
                search: debouncedSearch,
                status: statusFilter,
                category: 'all',
                public: 'all'
            })
            const res = await fetch(`/api/admin/wraps?${params.toString()}`)
            const data = await res.json()
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load works')

            const nextWraps = (data.wraps || []) as WrapRecord[]
            setWraps(nextWraps)
            setTotal(Number(data.total || 0))
            setHasMore(Boolean(data.hasMore))

            setSelectedIds((current) => {
                const next = new Set<string>()
                nextWraps.forEach((item) => {
                    if (current.has(item.id)) next.add(item.id)
                })
                return next
            })

            setActiveWrapId((current) => {
                if (current && nextWraps.some((item) => item.id === current)) return current
                return nextWraps[0]?.id || null
            })

            setBatchLogs((prev) => {
                const next = { ...prev }
                nextWraps.forEach((item) => {
                    if (!next[item.id]) next[item.id] = { status: 'pending' }
                })
                return next
            })
        } catch (err: any) {
            alert.error(err?.message || 'Failed to load works')
        } finally {
            setLoading(false)
        }
    }, [alert, debouncedSearch, page, statusFilter])

    useEffect(() => {
        fetchWraps()
    }, [fetchWraps])

    useEffect(() => {
        let mounted = true
        const fetchModels = async () => {
            try {
                const res = await fetch('/api/admin/models')
                const data = await res.json()
                if (!mounted) return
                if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load models')
                setModels(data.models || [])
            } catch (err) {
                console.error('[AdminWraps] fetch models failed:', err)
            }
        }
        fetchModels()
        return () => { mounted = false }
    }, [])

    const toggleSelect = (id: string) => {
        if (batchStatus === 'running') return
        setSelectedIds((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (batchStatus === 'running') return
        if (selectedIds.size === wraps.length) {
            setSelectedIds(new Set())
            return
        }
        setSelectedIds(new Set(wraps.map((item) => item.id)))
    }

    const hideSelected = async () => {
        const targets = selectedWraps.filter((item) => item.is_active)
        if (targets.length === 0) {
            alert.warning('No active works selected')
            return
        }

        const results = await Promise.allSettled(
            targets.map(async (item) => {
                const res = await fetch('/api/admin/wraps/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wrapId: item.id, is_active: false })
                })
                const data = await res.json()
                if (!res.ok || !data?.success) throw new Error(data?.error || 'Hide failed')
                return data
            })
        )

        const failedCount = results.filter((item) => item.status === 'rejected').length
        if (failedCount > 0) alert.warning(`Hidden ${targets.length - failedCount}, failed ${failedCount}`)
        else alert.success(`Hidden ${targets.length} work(s)`)

        setWraps((current) => current.map((item) => (selectedIds.has(item.id) ? { ...item, is_active: false } : item)))
        revalidateWraps()
    }

    const processWrap = useCallback(async (wrap: WrapRecord) => {
        if (!viewerRef.current) throw new Error('Viewer not ready')

        const isReady = await viewerRef.current.waitForReady(15000)
        if (!isReady) throw new Error('Viewer readiness timed out')
        await new Promise((resolve) => setTimeout(resolve, 500))

        const imageBase64 = await viewerRef.current.takeHighResScreenshot({ useStandardView: true })
        if (!imageBase64) throw new Error('Screenshot failed')

        const signRes = await fetch('/api/wrap/get-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wrapId: wrap.id })
        })
        const signData = await signRes.json()
        if (!signRes.ok || !signData?.success) throw new Error(signData?.error || 'Failed to sign upload URL')

        const base64Content = imageBase64.replace(/^data:image\/\w+;base64,/, '')
        const byteCharacters = atob(base64Content)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i += 1) byteNumbers[i] = byteCharacters.charCodeAt(i)
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' })

        const uploadRes = await fetch(signData.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: { 'Content-Type': 'image/png' }
        })
        if (!uploadRes.ok) throw new Error('Preview upload failed')

        const confirmRes = await fetch('/api/wrap/confirm-publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wrapId: wrap.id, ossKey: signData.ossKey })
        })
        const confirmData = await confirmRes.json()
        if (!confirmRes.ok || !confirmData?.success) throw new Error(confirmData?.error || 'Confirm publish failed')

        const newPreview = confirmData.previewUrl as string
        setWraps((current) => current.map((item) => (item.id === wrap.id ? { ...item, preview_url: newPreview } : item)))
    }, [])

    const runBatchStep = useCallback(async () => {
        if (batchStatus !== 'running' || isProcessing) return

        const nextIndex = batchIndex + 1
        if (nextIndex >= batchQueueIds.length) {
            setBatchStatus('completed')
            setIsProcessing(false)
            revalidateWraps()
            alert.success(`Batch completed (${batchQueueIds.length})`)
            return
        }

        const nextId = batchQueueIds[nextIndex]
        const wrap = wrapMap.get(nextId)
        if (!wrap) {
            setBatchIndex(nextIndex)
            return
        }

        setIsProcessing(true)
        setBatchIndex(nextIndex)
        setActiveWrapId(wrap.id)
        setBatchLogs((current) => ({ ...current, [wrap.id]: { status: 'processing' } }))

        try {
            await processWrap(wrap)
            setBatchLogs((current) => ({ ...current, [wrap.id]: { status: 'success' } }))
        } catch (err: any) {
            setBatchLogs((current) => ({ ...current, [wrap.id]: { status: 'error', message: String(err?.message || err) } }))
        } finally {
            setIsProcessing(false)
        }
    }, [alert, batchIndex, batchQueueIds, batchStatus, isProcessing, processWrap, wrapMap])

    useEffect(() => {
        if (batchStatus === 'running' && !isProcessing) runBatchStep()
    }, [batchStatus, isProcessing, runBatchStep])

    const startBatch = () => {
        if (selectedWraps.length === 0) {
            alert.warning('Select works first')
            return
        }

        const queue = selectedWraps.map((item) => item.id)
        setShowPreviewPanel(true)
        setBatchQueueIds(queue)
        setBatchIndex(-1)
        setBatchStatus('running')
        setBatchLogs((current) => {
            const next = { ...current }
            queue.forEach((id) => { next[id] = { status: 'pending' } })
            return next
        })
        setActiveWrapId(queue[0])
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return (
        <div className="space-y-4 max-w-[1800px] mx-auto pb-8">
            {zoomImage && (
                <div className="fixed inset-0 z-[80] bg-black/80 p-8 flex items-center justify-center" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} alt="zoom" className="max-h-full max-w-full object-contain rounded-xl" />
                </div>
            )}

            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Works</h1>
                    <p className="text-sm text-gray-500">Batch tools + paged list of all generated works</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setShowPreviewPanel((current) => !current)}
                        disabled={batchStatus === 'running'}
                        className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        {showPreviewPanel ? 'Hide Preview Panel' : 'Show Preview Panel'}
                    </button>
                    <button
                        onClick={toggleSelectAll}
                        disabled={loading || wraps.length === 0 || batchStatus === 'running'}
                        className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        {selectedIds.size === wraps.length && wraps.length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                        onClick={startBatch}
                        disabled={loading || selectedIds.size === 0 || batchStatus === 'running'}
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <Play size={16} /> Start Batch
                    </button>
                    <button
                        onClick={hideSelected}
                        disabled={loading || selectedIds.size === 0 || batchStatus === 'running'}
                        className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-black disabled:opacity-50 flex items-center gap-2"
                    >
                        <EyeOff size={16} /> Hide
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
                <div className={showPreviewPanel ? 'lg:w-[62%] bg-white rounded-2xl border border-gray-200 overflow-hidden' : 'w-full bg-white rounded-2xl border border-gray-200 overflow-hidden'}>
                    <div className="p-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{selectedIds.size} selected</span>
                            <span>Total {total}</span>
                            {batchStatus !== 'idle' && (
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                                    {batchStatus === 'running' ? `Running ${Math.max(batchIndex + 1, 0)}/${batchQueueIds.length}` : `Completed ${batchQueueIds.length}`}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search name/model/author"
                                    className="pl-8 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm min-w-[220px]"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value as 'all' | 'active' | 'hidden')
                                    setPage(1)
                                }}
                                className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm"
                            >
                                <option value="all">All</option>
                                <option value="active">Active</option>
                                <option value="hidden">Hidden</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-auto max-h-[72vh]">
                        {loading ? (
                            <div className="p-10 text-center text-gray-500">
                                <Loader2 className="animate-spin inline-block mr-2" size={16} /> Loading works...
                            </div>
                        ) : wraps.length === 0 ? (
                            <div className="p-10 text-center text-gray-500">No works found</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500 uppercase z-10">
                                    <tr>
                                        <th className="text-left p-3 w-10"></th>
                                        <th className="text-left p-3">Work</th>
                                        <th className="text-left p-3">Model</th>
                                        <th className="text-left p-3">User</th>
                                        <th className="text-left p-3">Browse</th>
                                        <th className="text-left p-3">Download</th>
                                        <th className="text-left p-3">Created</th>
                                        <th className="text-left p-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {wraps.map((wrap) => {
                                        const log = batchLogs[wrap.id]
                                        const isSelected = selectedIds.has(wrap.id)
                                        const isActive = activeWrapId === wrap.id
                                        const authorName = wrap.profiles?.display_name || wrap.profiles?.email || 'Anonymous'
                                        const avatar = wrap.profiles?.avatar_url ? getCdnUrl(wrap.profiles.avatar_url) : null

                                        return (
                                            <tr
                                                key={wrap.id}
                                                className={`border-t border-gray-100 cursor-pointer ${isActive ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}
                                                onClick={() => setActiveWrapId(wrap.id)}
                                            >
                                                <td className="p-3">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            toggleSelect(wrap.id)
                                                        }}
                                                        disabled={batchStatus === 'running'}
                                                        className="text-gray-500 disabled:opacity-40"
                                                    >
                                                        {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                                                    </button>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2 min-w-[200px]">
                                                        <button
                                                            type="button"
                                                            className="relative group"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setZoomImage(getCdnUrl(wrap.preview_url))
                                                            }}
                                                        >
                                                            <img src={getCdnUrl(wrap.preview_url)} alt={wrap.name} className="w-16 h-10 rounded object-cover bg-gray-100" />
                                                            <span className="absolute inset-0 bg-black/30 rounded opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                                                                <ZoomIn size={13} className="text-white" />
                                                            </span>
                                                        </button>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-900 truncate max-w-[130px]">{wrap.name || 'Untitled'}</p>
                                                            {!wrap.is_active && <p className="text-xs text-red-500">Hidden</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-gray-700">{getModelName(wrap.model_slug)}</td>
                                                <td className="p-3 text-gray-700">
                                                    <div className="flex items-center gap-2 max-w-[190px]">
                                                        {avatar ? (
                                                            <img src={avatar} alt={authorName} className="w-7 h-7 rounded-full object-cover border border-gray-200" />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200" />
                                                        )}
                                                        <span className="truncate">{authorName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-gray-700 font-medium">{wrap.browse_count ?? 0}</td>
                                                <td className="p-3 text-gray-700 font-medium">{wrap.download_count ?? 0}</td>
                                                <td className="p-3 text-gray-500 font-mono">{format(new Date(wrap.created_at), 'MM/dd HH:mm:ss')}</td>
                                                <td className="p-3">
                                                    <div className="space-y-1">
                                                        <div
                                                            className={`text-[11px] font-semibold ${
                                                                wrap.is_active && wrap.is_public
                                                                    ? 'text-green-700'
                                                                    : !wrap.is_active
                                                                        ? 'text-red-600'
                                                                        : 'text-amber-700'
                                                            }`}
                                                        >
                                                            {wrap.is_active && wrap.is_public ? 'Published' : !wrap.is_active ? 'Hidden' : 'Private'}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-mono">
                                                            {format(new Date(wrap.updated_at || wrap.created_at), 'MM/dd HH:mm:ss')}
                                                        </div>
                                                        {log?.status === 'success' && <CheckCircle2 className="text-green-500" size={14} />}
                                                        {log?.status === 'error' && <AlertCircle className="text-red-500" size={14} />}
                                                        {log?.status === 'processing' && <Loader2 className="text-blue-500 animate-spin" size={14} />}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="p-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Page {page} / {totalPages}</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                                disabled={page <= 1 || loading}
                                className="px-2 py-1.5 border border-gray-200 rounded-md text-sm disabled:opacity-40"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={() => setPage((current) => current + 1)}
                                disabled={!hasMore || loading}
                                className="px-2 py-1.5 border border-gray-200 rounded-md text-sm disabled:opacity-40"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {showPreviewPanel && (
                    <div className="lg:w-[38%] bg-white rounded-2xl border border-gray-200 p-4">
                        {!activeWrap ? (
                            <div className="text-sm text-gray-500">Select a work to inspect prompt/reference images.</div>
                        ) : (
                            <div className="space-y-3">
                                <div className="rounded-xl border border-gray-200 overflow-hidden bg-black" style={{ aspectRatio: '4 / 3' }}>
                                    {getModelUrl(activeWrap.model_slug) ? (
                                        <ModelViewer
                                            ref={viewerRef}
                                            modelUrl={toViewerAssetUrl(getModelUrl(activeWrap.model_slug)) || getModelUrl(activeWrap.model_slug)}
                                            wheelUrl={toViewerAssetUrl(getModelWheelUrl(activeWrap.model_slug))}
                                            textureUrl={toViewerAssetUrl(activeWrap.texture_url) || activeWrap.texture_url}
                                            modelSlug={activeWrap.model_slug}
                                            backgroundColor="#1F1F1F"
                                            autoRotate={false}
                                            className="w-full h-full"
                                        />
                                    ) : (
                                        <div className="w-full h-full grid place-items-center text-gray-400 text-sm">No model asset</div>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-gray-900">{activeWrap.name || 'Untitled'}</p>
                                        <p className="text-xs text-gray-500">Model: {getModelName(activeWrap.model_slug)}</p>
                                    </div>
                                    <a
                                        href={`/wraps/${activeWrap.slug || activeWrap.id}`}
                                        target="_blank"
                                        className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                                    >
                                        <Eye size={14} /> Open
                                    </a>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 mb-1">User Prompt</p>
                                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words min-h-[58px]">
                                        {activeWrap.prompt || 'No prompt'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 mb-2">Reference Images</p>
                                    {activeWrap.reference_images && activeWrap.reference_images.length > 0 ? (
                                        <div className="grid grid-cols-4 gap-2">
                                            {activeWrap.reference_images.map((url) => (
                                                <button
                                                    key={url}
                                                    type="button"
                                                    onClick={() => setZoomImage(getCdnUrl(url))}
                                                    className="block"
                                                >
                                                    <img
                                                        src={getCdnUrl(url)}
                                                        alt="reference"
                                                        className="w-full aspect-square rounded-lg object-cover bg-gray-100 border border-gray-200"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">No reference images</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
