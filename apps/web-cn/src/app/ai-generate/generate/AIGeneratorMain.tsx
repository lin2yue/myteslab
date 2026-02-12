'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslations } from '@/lib/i18n'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import Link from 'next/link'
import Image from 'next/image'
import StickerEditor from '@/components/sticker/StickerEditor'
import {
    Sun, Moon, RotateCw, Pause, Camera, Download, Globe, Check, Loader2,
    Sparkles, X, Plus, Palette, ArrowRight, ZoomIn
} from 'lucide-react'
import PricingModal from '@/components/pricing/PricingModal'
import { useRouter } from 'next/navigation'
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage'
import PublishModal from '@/components/publish/PublishModal'
import { useAlert } from '@/components/alert/AlertProvider'
import { ServiceType, getServiceCost } from '@/lib/constants/credits'
import { useCredits } from '@/components/credits/CreditsProvider'
import Select from '@/components/ui/Select'
import { createModelNameResolver } from '@/lib/model-display'
import { sortModelsByPreferredOrder } from '@/lib/model-order'
import { getMaskDimensions } from '@/lib/ai/mask-config'
import { getEffectiveTheme, THEME_CHANGE_EVENT } from '@/utils/theme'

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

type TaskStatus = 'pending' | 'processing' | 'failed' | 'failed_refunded'

interface TaskStep {
    step: string
    ts?: string
    reason?: string
}

interface GenerationTaskHistory {
    id: string
    prompt: string
    status: TaskStatus
    error_message: string | null
    steps?: TaskStep[]
    is_retrying?: boolean
    retry_started_at?: string | null
    created_at: string
    updated_at: string
    model_slug?: string | null
}

type HistoryListItem =
    | { type: 'wrap'; createdAt: string; wrap: GenerationHistory }
    | { type: 'task'; createdAt: string; task: GenerationTaskHistory }

const ESTIMATED_GENERATE_SECONDS = 30
const BALANCE_LABEL_MIN_WIDTH = 260

function stripOssProcess(url: string): string {
    if (!url) return url

    try {
        const parsed = new URL(url)
        parsed.searchParams.delete('x-oss-process')
        return parsed.toString()
    } catch {
        try {
            const parsed = new URL(url, 'https://local.invalid')
            parsed.searchParams.delete('x-oss-process')
            return `${parsed.pathname}${parsed.search}${parsed.hash}`
        } catch {
            return url
        }
    }
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read image data'))
        reader.readAsDataURL(blob)
    })
}

function resizeDataUrl(dataUrl: string, width: number, height: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = document.createElement('img')
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Failed to create canvas context'))
                return
            }
            ctx.drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/png'))
        }
        img.onerror = () => reject(new Error('Failed to load image for resize'))
        img.src = dataUrl
    })
}

function toBase64Url(input: string): string {
    return btoa(unescape(encodeURIComponent(input)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '')
}

async function buildIdempotencyKey(raw: string): Promise<string> {
    // Use SHA-256 hex to avoid collisions/truncation while keeping key compact.
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
        const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
        const bytes = Array.from(new Uint8Array(digest))
        return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
    }
    return toBase64Url(raw)
}

function formatDateTime(ts: string, locale: string) {
    const date = new Date(ts)
    if (Number.isNaN(date.getTime())) return ts
    const normalized = locale === 'zh' ? 'zh-CN' : 'en-US'
    return date.toLocaleString(normalized, {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

function mergeTaskHistory(
    previous: GenerationTaskHistory[],
    incoming: GenerationTaskHistory[]
): GenerationTaskHistory[] {
    const byId = new Map<string, GenerationTaskHistory>()
    previous.forEach(item => byId.set(item.id, item))
    incoming.forEach(item => {
        const prev = byId.get(item.id)
        byId.set(item.id, {
            ...prev,
            ...item,
            steps: item.steps || prev?.steps || [],
            is_retrying: typeof item.is_retrying === 'boolean' ? item.is_retrying : (prev?.is_retrying ?? false),
            retry_started_at: item.retry_started_at ?? prev?.retry_started_at ?? null,
            model_slug: item.model_slug || prev?.model_slug || null
        })
    })
    return Array.from(byId.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50)
}

function normalizeTaskSteps(raw: unknown): TaskStep[] {
    if (!Array.isArray(raw)) return []
    return raw
        .map((item) => {
            if (!item || typeof item !== 'object') return null
            const step = typeof (item as any).step === 'string' ? (item as any).step : ''
            if (!step) return null
            return {
                step,
                ts: typeof (item as any).ts === 'string' ? (item as any).ts : undefined,
                reason: typeof (item as any).reason === 'string' ? (item as any).reason : undefined
            }
        })
        .filter(Boolean) as TaskStep[]
}

function resolveRetryState(status: TaskStatus, steps: TaskStep[]) {
    const retryOptimizedStep = [...steps].reverse().find(step => step.step === 'prompt_retry_optimized')
    const retryEnded = steps.some(step =>
        step.step === 'prompt_retry_success'
        || step.step === 'prompt_retry_failed'
        || step.step === 'prompt_retry_skipped'
    )
    const isRetrying = Boolean(retryOptimizedStep) && !retryEnded && (status === 'pending' || status === 'processing')
    return {
        isRetrying,
        retryStartedAt: isRetrying ? (retryOptimizedStep?.ts || null) : null
    }
}

export default function AIGeneratorMain({
    initialCredits,
    models,
    locale: _locale,
    isLoggedIn
}: {
    initialCredits: number,
    models: Array<{ slug: string; name: string; name_en?: string; modelUrl?: string; wheelUrl?: string }>,
    locale: string,
    isLoggedIn: boolean
}) {
    const t = useTranslations('Common')
    const tIndex = useTranslations('Index')
    const tGen = useTranslations('Generator')
    const alert = useAlert()
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'
    const sortedModels = useMemo(() => sortModelsByPreferredOrder(models), [models])
    const getModelName = useMemo(() => createModelNameResolver(sortedModels, _locale), [sortedModels, _locale])

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

    const initialModelSlug = sortedModels[0]?.slug || 'cybertruck'

    const { balance, setBalance, refresh: refreshCredits } = useCredits()
    const [selectedModel, setSelectedModel] = useState(initialModelSlug)
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
    const [taskHistory, setTaskHistory] = useState<GenerationTaskHistory[]>([])
    const [isUploadingRefs, setIsUploadingRefs] = useState(false)
    const sessionGuidRef = useRef<string>(Math.random().toString(36).substring(2, 15))
    const retrySeedRef = useRef<number>(0)
    const submitSeqRef = useRef<number>(0)
    const autoRegenTriggeredRef = useRef(false)
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
    const [elapsedNow, setElapsedNow] = useState<number>(Date.now())

    // 3D 控制状态
    const [isNight, setIsNight] = useState(false)
    const isNightManualRef = useRef(false)
    const [autoRotate, setAutoRotate] = useState(true)
    const viewerRef = useRef<ModelViewerRef>(null)
    const balancePanelRef = useRef<HTMLDivElement>(null)
    const isFetchingRef = useRef(false)
    const [isLoggedInInternal, setIsLoggedInInternal] = useState(isLoggedIn)
    const [showBalanceLabels, setShowBalanceLabels] = useState(false)

    const aiThemeStorageKey = 'ai_viewer_theme'

    // 当模型改变时保存到 localStorage
    useEffect(() => {
        if (typeof window !== 'undefined' && selectedModel) {
            localStorage.setItem('ai_generator_last_model', selectedModel)
        }
    }, [selectedModel])

    // Hydration-safe restore: only read localStorage after mount.
    useEffect(() => {
        if (typeof window === 'undefined') return
        const params = new URLSearchParams(window.location.search)
        if (params.get('regenFromWrap') === '1') {
            const targetModel = params.get('targetModel')
            if (targetModel && sortedModels.some(m => m.slug === targetModel)) {
                return
            }
        }
        const savedModel = localStorage.getItem('ai_generator_last_model')
        setSelectedModel((prev) => {
            if (savedModel && sortedModels.some(m => m.slug === savedModel)) {
                return savedModel
            }
            if (sortedModels.some(m => m.slug === prev)) {
                return prev
            }
            return sortedModels[0]?.slug || prev
        })
    }, [sortedModels])

    // Sync 3D day/night with theme by default, unless user manually overrides
    useEffect(() => {
        if (typeof window === 'undefined') return
        const stored = localStorage.getItem(aiThemeStorageKey)
        if (stored === 'night' || stored === 'day') {
            isNightManualRef.current = true
            setIsNight(stored === 'night')
            return
        }
        const effective = getEffectiveTheme()
        setIsNight(effective === 'dark')
    }, [])

    useEffect(() => {
        const handler = (event: Event) => {
            if (isNightManualRef.current) return
            const detail = (event as CustomEvent).detail as { effective?: string } | undefined
            const effective = detail?.effective || getEffectiveTheme()
            setIsNight(effective === 'dark')
        }
        window.addEventListener(THEME_CHANGE_EVENT, handler as EventListener)
        return () => window.removeEventListener(THEME_CHANGE_EVENT, handler as EventListener)
    }, [])

    // Sync internal login state with prop
    useEffect(() => {
        setIsLoggedInInternal(isLoggedIn)
    }, [isLoggedIn])

    // 自适应积分区域文案：空间不足时优先显示数字
    useEffect(() => {
        const el = balancePanelRef.current
        if (!el) return

        const update = () => {
            const nextVisible = el.clientWidth >= BALANCE_LABEL_MIN_WIDTH
            setShowBalanceLabels((prev) => (prev === nextVisible ? prev : nextVisible))
        }

        update()

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => update())
            observer.observe(el)
            return () => observer.disconnect()
        }

        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    // Seed initial credits if provider hasn't loaded yet
    useEffect(() => {
        if (balance === null && initialCredits > 0) {
            setBalance(initialCredits)
        }
    }, [balance, initialCredits, setBalance])


    // 获取历史记录
    const [isFetchingHistory, setIsFetchingHistory] = useState(false)
    const fetchHistory = useCallback(async () => {
        if (isFetchingRef.current) return
        isFetchingRef.current = true
        setIsFetchingHistory(true)
        try {
            const res = await fetch(`/api/wrap/history?category=${activeMode === 'diy' ? 'diy' : 'ai_generated'}`)
            if (res.status === 401) {
                setIsLoggedInInternal(false)
                setHistory([])
                return
            }
            const data = await res.json()
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to fetch history')
            }
            setHistory(data.wraps || [])
            const tasksRaw = Array.isArray(data.tasks)
                ? (data.tasks as Array<Record<string, unknown>>)
                : []
            const tasksFromServer: GenerationTaskHistory[] = tasksRaw.map((task) => {
                const statusRaw = typeof task.status === 'string' ? task.status : 'pending'
                const status: TaskStatus = (
                    statusRaw === 'processing'
                    || statusRaw === 'failed'
                    || statusRaw === 'failed_refunded'
                )
                    ? statusRaw
                    : 'pending'
                const steps = normalizeTaskSteps(task.steps)
                const retryState = resolveRetryState(status, steps)
                return {
                    id: String(task.id || ''),
                    prompt: String(task.prompt || ''),
                    status,
                    error_message: task.error_message ? String(task.error_message) : null,
                    steps,
                    is_retrying: retryState.isRetrying,
                    retry_started_at: retryState.retryStartedAt,
                    created_at: String(task.created_at || new Date().toISOString()),
                    updated_at: String(task.updated_at || task.created_at || new Date().toISOString()),
                    model_slug: typeof task.model_slug === 'string' ? task.model_slug : null
                }
            }).filter(task => task.id)
            setTaskHistory(prev => {
                const activeIds = new Set(tasksFromServer.map(task => task.id))
                const previousActive = prev.filter(task => activeIds.has(task.id))
                return mergeTaskHistory(previousActive, tasksFromServer)
            })
        } catch (err) {
            console.error('Fetch history error:', err)
            // Optional: could set an error state here to show in UI
            setHistory([]) // Ensure we exit loading state
        } finally {
            isFetchingRef.current = false
            setIsFetchingHistory(false)
        }
    }, [activeMode])

    const checkAuth = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me')
            if (!res.ok) {
                setIsLoggedInInternal(false)
                return
            }
            const data = await res.json()
            setIsLoggedInInternal(!!data?.user)
        } catch {
            setIsLoggedInInternal(false)
        }
    }, [])

    useEffect(() => {
        checkAuth()
        fetchHistory()
    }, [checkAuth, fetchHistory])

    const pendingTaskIds = useMemo(
        () => taskHistory
            .filter(task => task.status === 'pending' || task.status === 'processing')
            .map(task => task.id),
        [taskHistory]
    )

    const pendingTaskKey = useMemo(
        () => [...pendingTaskIds].sort().join(','),
        [pendingTaskIds]
    )

    useEffect(() => {
        if (pendingTaskIds.length === 0) return
        const timer = window.setInterval(() => setElapsedNow(Date.now()), 100)
        return () => window.clearInterval(timer)
    }, [pendingTaskKey])

    useEffect(() => {
        if (pendingTaskIds.length === 0) return
        let active = true

        const pollSingleTask = async (taskId: string) => {
            try {
                const res = await fetch('/api/wrap/by-task', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskId })
                })
                if (!active) return
                if (!res.ok) return
                const data = await res.json()
                if (!active) return

                if (data?.wrap?.id) {
                    setTaskHistory(prev => prev.filter(task => task.id !== taskId))
                    setCurrentTexture(data.wrap.preview_url || data.wrap.texture_url)
                    setActiveWrapId(data.wrap.id)
                    fetchHistory()
                    return
                }

                if (data?.status === 'failed') {
                    retrySeedRef.current += 1
                    const failedStatus: TaskStatus = (data?.taskStatus === 'failed_refunded' || data?.refunded)
                        ? 'failed_refunded'
                        : 'failed'
                    setTaskHistory(prev => prev.map(task => (
                        task.id === taskId
                            ? {
                                ...task,
                                status: failedStatus,
                                error_message: data.error || task.error_message || '任务失败',
                                is_retrying: false,
                                retry_started_at: null,
                                updated_at: new Date().toISOString()
                            }
                            : task
                    )))
                    return
                }

                if (data?.status === 'completed_missing') {
                    retrySeedRef.current += 1
                    setTaskHistory(prev => prev.map(task => (
                        task.id === taskId
                            ? {
                                ...task,
                                status: 'failed',
                                error_message: '任务已完成但结果缺失，请稍后重试',
                                is_retrying: false,
                                retry_started_at: null,
                                updated_at: new Date().toISOString()
                            }
                            : task
                    )))
                    return
                }

                setTaskHistory(prev => prev.map(task => (
                    task.id === taskId
                        ? {
                            ...task,
                            status: (data?.status === 'processing' ? 'processing' : 'pending'),
                            is_retrying: Boolean(data?.retrying),
                            retry_started_at: typeof data?.retryStartedAt === 'string' ? data.retryStartedAt : (task.retry_started_at || null),
                            updated_at: new Date().toISOString()
                        }
                        : task
                )))
            } catch (err) {
                console.error('Polling wrap by task id failed:', err)
            }
        }

        const pollAll = async () => {
            // Poll sequentially to avoid burst requests when multiple tasks are pending.
            for (const taskId of pendingTaskIds) {
                if (!active) return
                await pollSingleTask(taskId)
            }
        }

        void pollAll()
        const timer = window.setInterval(() => void pollAll(), 5000)

        return () => {
            active = false
            window.clearInterval(timer)
        }
    }, [pendingTaskKey, fetchHistory, pendingTaskIds])

    // 生成逻辑
    const isBusy = isGenerating

    const submitGeneration = async (options?: {
        promptValue?: string
        modelSlug?: string
        clearRefs?: boolean
        referenceImagesOverride?: string[]
    }) => {
        const promptValue = (options?.promptValue ?? prompt).trim()
        const modelSlugValue = options?.modelSlug ?? selectedModel
        const usedReferenceImages = options?.referenceImagesOverride ?? (options?.clearRefs ? [] : referenceImages)

        if (!isLoggedInInternal) {
            const currentUrl = window.location.pathname + window.location.search
            if (typeof window !== 'undefined') {
                localStorage.setItem('auth_redirect_next', currentUrl)
            }
            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
            return false
        }
        if (!promptValue || isBusy) return false

        const requiredCredits = getServiceCost(ServiceType.AI_GENERATION)
        const currentBalance = balance ?? 0
        if (currentBalance < requiredCredits) {
            alert.warning(`积分不足，需要 ${requiredCredits} 积分，当前余额 ${currentBalance}`)
            setShowPricing(true)
            return false
        }

        setIsGenerating(true)
        let bumpIdempotency = false
        try {
            submitSeqRef.current += 1
            const timeBucket = Math.floor(Date.now() / (5 * 60 * 1000))
            const idempotencyRaw = `${sessionGuidRef.current}-${modelSlugValue}-${promptValue}-${timeBucket}-${retrySeedRef.current}-${submitSeqRef.current}`
            const idempotencyKey = await buildIdempotencyKey(idempotencyRaw)

            const payload = JSON.stringify({
                modelSlug: modelSlugValue,
                prompt: promptValue,
                referenceImages: usedReferenceImages,
                idempotencyKey
            })

            if (payload.length > 4 * 1024 * 1024) {
                throw new Error(`参考图片总数据量过大 (${(payload.length / 1024 / 1024).toFixed(2)} MB)，请减少图片数量或更换更小的图片`)
            }

            console.log(`[AI-GEN] Requesting with idempotencyKey: ${idempotencyKey}, size: ${(payload.length / 1024).toFixed(2)} KB`)

            const res = await fetch('/api/wrap/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            })

            if (!res.ok) {
                if (res.status >= 500 && res.status !== 504) {
                    bumpIdempotency = true
                }
                if (res.status === 413) {
                    throw new Error(`上传的图片过大 (Payload: ${(payload.length / 1024 / 1024).toFixed(2)} MB)，服务器拒绝接收`)
                }
                if (res.status === 504) {
                    throw new Error('服务器超时，任务可能在后台继续执行，请稍后刷新历史记录查看结果')
                }

                let errorMessage = `请求失败 (${res.status})`
                try {
                    const errorData = await res.json()
                    errorMessage = errorData.error || errorMessage
                } catch (_e) {
                    const text = await res.text()
                    if (text) errorMessage = `${errorMessage}: ${text.substring(0, 50)}`
                }
                throw new Error(errorMessage)
            }

            const data = await res.json()
            if (!data.success) {
                bumpIdempotency = true
                if (data.taskId) {
                    const nowIso = new Date().toISOString()
                    setTaskHistory(prev => mergeTaskHistory(prev, [{
                        id: data.taskId,
                        prompt: promptValue,
                        status: 'failed',
                        error_message: data.error || '任务失败',
                        steps: [],
                        is_retrying: false,
                        retry_started_at: null,
                        created_at: nowIso,
                        updated_at: nowIso,
                        model_slug: modelSlugValue
                    }]))
                }
                throw new Error(data.error)
            }

            if (data.status === 'pending') {
                const nowIso = new Date().toISOString()
                setTaskHistory(prev => mergeTaskHistory(prev, [{
                    id: data.taskId,
                    prompt: promptValue,
                    status: 'pending',
                    error_message: null,
                    steps: [],
                    is_retrying: false,
                    retry_started_at: null,
                    created_at: nowIso,
                    updated_at: nowIso,
                    model_slug: modelSlugValue
                }]))
                alert.info('任务已提交，正在后台生成')
                return true
            }

            if (data?.image?.dataUrl) {
                setCurrentTexture(data.image.dataUrl)
            }
            if (data?.wrapId) {
                setActiveWrapId(data.wrapId)
            }

            setBalance(data.remainingBalance)
            refreshCredits()
            setTimeout(fetchHistory, 600)
            return true
        } catch (err) {
            if (bumpIdempotency) {
                retrySeedRef.current += 1
            }
            const message = err instanceof Error ? err.message : String(err)
            alert.error(`生成失败: ${message}`)
            return false
        } finally {
            setIsGenerating(false)
        }
    }

    const handleGenerate = async () => {
        await submitGeneration()
    }

    const handleRetryTask = async (task: GenerationTaskHistory) => {
        const nextModel = task.model_slug || selectedModel
        setPrompt(task.prompt)
        setSelectedModel(nextModel)
        await submitGeneration({
            promptValue: task.prompt,
            modelSlug: nextModel,
            clearRefs: true
        })
    }

    const handleDownload = async () => {
        if (!isLoggedInInternal) {
            const currentUrl = window.location.pathname + window.location.search
            if (typeof window !== 'undefined') {
                localStorage.setItem('auth_redirect_next', currentUrl)
            }
            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
            return
        }

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
        if (!currentTexture) {
            alert.warning('当前作品贴图还未就绪，请稍后再发布')
            return
        }

        // 已经发布了就不再操作
        const currentWrap = activeWrapId ? history.find(h => h.id === activeWrapId) : null;
        if (currentWrap?.is_public) return;

        // 打开预览弹窗，而不再直接执行发布
        setShowPublishModal(true);
    };

    const confirmPublish = async (previewImageBase64: string) => {
        if (!isLoggedInInternal) {
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

    const processFiles = async (files: FileList | File[]) => {
        if (!isLoggedInInternal) {
            const currentUrl = window.location.pathname + window.location.search
            if (typeof window !== 'undefined') {
                localStorage.setItem('auth_redirect_next', currentUrl)
            }
            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
            return
        }

        const maxImages = 3
        const remainingSlots = maxImages - referenceImages.length

        if (remainingSlots <= 0) {
            alert.warning(`最多上传 ${maxImages} 张参考图`);
            return;
        }

        const filesToProcess = Array.from(files).filter(file => file.type.startsWith('image/')).slice(0, remainingSlots)
        if (filesToProcess.length === 0) return

        try {
            setIsUploadingRefs(true)
            // Dynamically import utility to avoid server-side issues
            const { compressImage } = await import('@/utils/image');

            const dataUrls = await Promise.all(
                filesToProcess.map(file => compressImage(file, 1024, 0.8))
            );

            const uploadedUrls: string[] = []
            let failedCount = 0
            for (const dataUrl of dataUrls) {
                const uploadResult = await uploadReferenceImage(dataUrl)
                if (uploadResult) {
                    uploadedUrls.push(uploadResult)
                } else {
                    failedCount += 1
                }
            }

            if (uploadedUrls.length > 0) {
                setReferenceImages(prev => [...prev, ...uploadedUrls]);
            }
            if (failedCount > 0) {
                alert.warning(`有 ${failedCount} 张参考图上传失败，请重试`)
            }
        } catch (err) {
            console.error('Image processing failed:', err);
            alert.error('图片处理失败，请重试');
        } finally {
            setIsUploadingRefs(false)
        }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return
        await processFiles(e.target.files)
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const dataUrlToBlob = (dataUrl: string) => {
        const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
        if (!match) return null;
        const contentType = match[1];
        const base64Data = match[2];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return { blob: new Blob([new Uint8Array(byteNumbers)], { type: contentType }), contentType };
    };

    const uploadReferenceImage = async (dataUrl: string): Promise<string | null> => {
        const parsed = dataUrlToBlob(dataUrl);
        if (!parsed) return null;
        const { blob, contentType } = parsed;
        const ext = contentType === 'image/png' ? 'png' : 'jpg';

        for (let attempt = 1; attempt <= 2; attempt += 1) {
            const signRes = await fetch('/api/wrap/get-reference-upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentType, ext })
            });

            if (!signRes.ok) {
                console.error('Failed to get reference upload URL');
                continue;
            }

            const signData = await signRes.json();
            if (!signData.success) {
                console.error('Failed to get reference upload URL:', signData.error);
                continue;
            }

            const uploadRes = await fetch(signData.uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': contentType }
            });

            if (uploadRes.ok) {
                return signData.publicUrl as string;
            }
            console.error('Reference image upload failed');
        }

        return null;
    };

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (autoRegenTriggeredRef.current) return

        const params = new URLSearchParams(window.location.search)
        if (params.get('regenFromWrap') !== '1') return

        const sourceTexture = params.get('sourceTexture')
        const targetModel = params.get('targetModel')
        const sourcePrompt = params.get('sourcePrompt')?.trim()

        if (!sourceTexture || !targetModel) return
        if (!sortedModels.some(m => m.slug === targetModel)) return

        if (!isLoggedInInternal) {
            const currentUrl = window.location.pathname + window.location.search
            localStorage.setItem('auth_redirect_next', currentUrl)
            router.push(`/login?next=${encodeURIComponent(currentUrl)}`)
            return
        }

        autoRegenTriggeredRef.current = true

        void (async () => {
            try {
                setActiveMode('ai')
                setSelectedModel(targetModel)
                if (typeof window !== 'undefined') {
                    localStorage.setItem('ai_generator_last_model', targetModel)
                }

                const targetName = getModelName(targetModel)
                const finalPrompt = sourcePrompt && sourcePrompt.length > 0
                    ? sourcePrompt
                    : (_locale === 'en'
                        ? `Keep the key visual style from the reference and adapt it for Tesla ${targetName}.`
                        : `保持参考图主视觉风格，并适配到特斯拉 ${targetName} 车型。`)

                setPrompt(finalPrompt)

                // Cross-model relay should use raw texture in mask orientation.
                // Remove OSS runtime transform params (rotate/resize/format) before fetching.
                const rawSourceTexture = getCdnUrl(stripOssProcess(sourceTexture))
                const fetchUrl = rawSourceTexture.startsWith('http')
                    ? `/api/proxy?url=${encodeURIComponent(rawSourceTexture)}`
                    : rawSourceTexture

                let sourceRes = await fetch(fetchUrl)
                if (!sourceRes.ok) {
                    // Fallback for legacy records: retry with original texture URL.
                    const fallbackSourceTexture = getCdnUrl(sourceTexture)
                    const fallbackFetchUrl = fallbackSourceTexture.startsWith('http')
                        ? `/api/proxy?url=${encodeURIComponent(fallbackSourceTexture)}`
                        : fallbackSourceTexture

                    if (fallbackFetchUrl !== fetchUrl) {
                        sourceRes = await fetch(fallbackFetchUrl)
                    }
                }

                if (!sourceRes.ok) {
                    throw new Error(_locale === 'en' ? 'Failed to load source texture' : '读取原车型贴图失败')
                }

                const sourceBlob = await sourceRes.blob()
                const sourceDataUrl = await blobToDataUrl(sourceBlob)
                const targetDims = getMaskDimensions(targetModel)
                const resizedDataUrl = await resizeDataUrl(sourceDataUrl, targetDims.width, targetDims.height)

                const uploadedRefUrl = await uploadReferenceImage(resizedDataUrl)
                if (!uploadedRefUrl) {
                    throw new Error(_locale === 'en' ? 'Reference upload failed' : '参考图上传失败')
                }

                setReferenceImages([uploadedRefUrl])

                const started = await submitGeneration({
                    promptValue: finalPrompt,
                    modelSlug: targetModel,
                    referenceImagesOverride: [uploadedRefUrl]
                })

                if (started) {
                    alert.info(_locale === 'en' ? 'Cross-model generation started.' : '已开始生成目标车型任务')
                }
            } catch (error) {
                console.error('[AI-GEN] Cross-model auto generation failed:', error)
                const fallback = _locale === 'en' ? 'Failed to start cross-model generation' : '生成其他车型任务启动失败'
                alert.error(error instanceof Error ? `${fallback}: ${error.message}` : fallback)
            }
        })()
    }, [isLoggedInInternal, sortedModels, router, getModelName, _locale, alert, submitGeneration])

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return

        const files: File[] = []
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile()
                if (file) files.push(file)
            }
        }

        if (files.length > 0) {
            e.preventDefault() // 防止图片数据作为文本插入（虽然通常不会，但防止意外触发）
            await processFiles(files)
        }
    }

    const removeImage = (index: number) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index))
    }

    const takeSnapshot = async () => {
        if (!viewerRef.current) return;

        try {
            // 手动拍照时不干预视角 (zoomOut: false)
            const dataUrl = await viewerRef.current.takeHighResScreenshot({ zoomOut: false, preserveAspect: true });
            if (dataUrl) {
                const link = document.createElement('a');
                link.download = `tewan-design-${selectedModel}-${Date.now()}.png`;
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

    const historyItems = useMemo<HistoryListItem[]>(() => {
        const taskItems: HistoryListItem[] = taskHistory.map(task => ({
            type: 'task',
            createdAt: task.created_at,
            task
        }))
        const wrapItems: HistoryListItem[] = history.map(wrap => ({
            type: 'wrap',
            createdAt: wrap.created_at,
            wrap
        }))
        return [...taskItems, ...wrapItems]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [history, taskHistory])

    return (
        <div className="flex flex-col h-auto lg:h-[calc(100vh-64px)] bg-transparent overflow-y-auto lg:overflow-hidden">
            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-visible lg:overflow-hidden w-full mx-auto">

                {/* Left Side: 3D Preview (65%) */}
                <div className="flex-none lg:flex-[6.5] flex flex-col p-4 pb-0 overflow-hidden bg-white/60 dark:bg-zinc-950/40 backdrop-blur">
                    <div className="relative flex-1 aspect-video max-h-[50vh] min-h-[220px] lg:aspect-auto lg:max-h-none overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/60 shadow-[0_12px_30px_rgba(0,0,0,0.12)] backdrop-blur">
                        <ModelViewer
                            ref={viewerRef}
                            id="ai-viewer"
                            modelUrl={getProxyUrl(models.find((m: any) => m.slug === selectedModel)?.modelUrl || '', { stable: true })}
                            wheelUrl={getProxyUrl(models.find((m: any) => m.slug === selectedModel)?.wheelUrl || '', { stable: true })}
                            textureUrl={currentTexture || undefined}
                            modelSlug={selectedModel}
                            backgroundColor={isNight ? '#1F1F1F' : '#FFFFFF'}
                            autoRotate={autoRotate}
                            className="w-full h-full"
                        />
                    </div>

                    {/* Bottom Controls for 3D */}
                    <div className="flex flex-row items-center px-6 py-4 border-t border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-950/80 gap-2 overflow-x-auto backdrop-blur -mx-4 mt-4" >
                        <button
                            onClick={() => {
                                const next = !isNight
                                setIsNight(next)
                                isNightManualRef.current = true
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem(aiThemeStorageKey, next ? 'night' : 'day')
                                }
                            }}
                            className="btn-secondary h-10 px-4 rounded-lg flex items-center gap-1.5 flex-shrink-0"
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
                            className={`btn-secondary h-10 px-4 rounded-lg flex items-center gap-1.5 flex-shrink-0 ${autoRotate ? 'bg-black/10 text-zinc-900 dark:text-white' : ''}`}
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
                            className="btn-secondary h-10 px-4 rounded-lg flex items-center gap-1.5 flex-shrink-0"
                        >
                            <>
                                <Camera className="w-5 h-5 lg:w-4 lg:h-4" />
                                <span className="hidden lg:inline">{tGen('screenshot')}</span>
                            </>
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={!currentTexture}
                            className="btn-secondary h-10 px-4 rounded-lg flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <>
                                <Download className="w-5 h-5 lg:w-4 lg:h-4" />
                                <span className="hidden lg:inline">{tGen('download_png')}</span>
                            </>
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={isPublishing || isSaving || (activeMode === 'ai' && (!activeWrapId || !currentTexture)) || (activeMode === 'diy' && !currentTexture) || (activeWrapId ? history.find(h => h.id === activeWrapId)?.is_public : false)}
                            className={`flex items-center gap-1.5 flex-shrink-0 ${isPublishing || isSaving ? 'h-10 px-4 rounded-lg bg-gray-100' : (activeWrapId && history.find(h => h.id === activeWrapId)?.is_public ? 'h-10 px-4 rounded-lg bg-gray-100 text-gray-400' : 'btn-primary h-10 px-4')}`}
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
                    </div >
                </div>

                {/* Right Side: Controls (30%) */}
                <div className="flex-none lg:flex-[3.5] flex flex-col border-l border-black/5 dark:border-white/10 overflow-visible lg:overflow-hidden bg-white/80 dark:bg-zinc-950/60 backdrop-blur">

                    {/* Mode Switcher Tabs */}
                    <div className="flex border-b border-black/5 dark:border-white/10 bg-transparent" >
                        <button
                            onClick={() => {
                                setActiveMode('ai');
                                setCurrentTexture(null);
                                setActiveWrapId(null);
                            }}
                            className={`flex-1 h-12 font-bold transition-all text-base tracking-tight relative ${activeMode === 'ai'
                                ? 'text-gray-900 dark:text-white'
                                : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
                                }`}
                        >
                            {tGen('mode_ai')}
                            {activeMode === 'ai' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white" />}
                        </button>
                        <button
                            onClick={() => {
                                setActiveMode('diy');
                                setCurrentTexture(null);
                                setActiveWrapId(null);
                            }}
                            className={`flex-1 h-12 font-bold transition-all text-base tracking-tight relative ${activeMode === 'diy'
                                ? 'text-gray-900 dark:text-white'
                                : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
                                }`}
                        >
                            {tGen('mode_diy')}
                            {activeMode === 'diy' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white" />}
                        </button>
                    </div >

                    {/* Conditional Panels */}
                    <div className="flex-1 min-h-0 flex flex-col">
                        {activeMode === 'ai' ? (
                            <div className="flex flex-col h-full">
                                {/* Model, Credits & Buy Area in One Row - Specific for AI */}
                                <div className="flex gap-3 items-center px-4 py-3 bg-transparent order-1">
                                    <div className="flex-[3]">
                                        <Select
                                            value={selectedModel}
                                            options={sortedModels.map((m: any) => ({
                                                value: m.slug,
                                                label: _locale === 'en' ? (m.name_en || m.name) : m.name
                                            }))}
                                            onChange={(value) => {
                                                setSelectedModel(value)
                                                setCurrentTexture(null)
                                                setActiveWrapId(null)
                                            }}
                                        />
                                    </div>

                                    <div
                                        ref={balancePanelRef}
                                        className="flex-[2] min-w-0 flex items-center gap-2 h-12 bg-white/90 dark:bg-zinc-900/70 border border-black/10 dark:border-white/10 rounded-xl px-2.5"
                                    >
                                        <div className="flex items-baseline gap-2 min-w-0">
                                            {showBalanceLabels && (
                                                <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                                                    {tGen('balance_label')}
                                                </span>
                                            )}
                                            <span className="text-base font-semibold text-gray-900 dark:text-white truncate whitespace-nowrap">
                                                {isLoggedInInternal ? (balance ?? 0) : (showBalanceLabels ? tGen('login_to_view') : '--')}
                                            </span>
                                            {showBalanceLabels && (
                                                <span className="text-[10px] text-gray-400 dark:text-zinc-400 uppercase tracking-wide">
                                                    {tGen('credits_label')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1" />
                                        <button
                                            onClick={handleBuyCredits}
                                            className="btn-secondary h-9 px-3 text-xs whitespace-nowrap flex-shrink-0"
                                        >
                                            {tGen('buy_short')}
                                        </button>
                                    </div>
                                </div>

                                {/* Input Area */}
                                <div className="p-4 flex flex-col gap-3 order-2 bg-transparent">
                                    <div className="bg-white/90 dark:bg-zinc-900/70 border border-black/10 dark:border-white/10 rounded-2xl pt-4 px-4 pb-2 focus-within:ring-2 focus-within:ring-black/10 transition-all flex flex-col gap-4">
                                        <textarea
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            onPaste={handlePaste}
                                            placeholder={tGen('prompt_placeholder')}
                                            className="w-full h-20 resize-none text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 focus:outline-none text-sm bg-transparent px-0.5"
                                        />

                                        {/* Reference Images Area - Nested inside input box */}
                                        <div className="flex items-center gap-3 border-t border-black/5 dark:border-white/10 pt-3">
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight whitespace-nowrap">
                                                {tGen('reference_images', { count: referenceImages.length })}
                                            </div>
                                            <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar p-2">
                                                {referenceImages.length < 3 && (
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
                                                        className="w-12 h-12 flex-shrink-0 border-2 border-dashed border-black/10 dark:border-white/15 rounded-lg flex items-center justify-center text-gray-400 hover:border-zinc-800 hover:text-zinc-900 transition-all bg-black/5 dark:bg-white/10"
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                )}

                                                {referenceImages.map((img, index) => (
                                                    <div key={index} className="relative w-12 h-12 flex-shrink-0 group">
                                                        <Image
                                                            src={img}
                                                            alt="reference"
                                                            width={48}
                                                            height={48}
                                                            className="w-full h-full object-cover rounded-lg border border-black/5 dark:border-white/10"
                                                        />
                                                        <button
                                                            onClick={() => removeImage(index)}
                                                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110 z-10"
                                                        >
                                                            <X className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageUpload}
                                    />

                                    <button
                                        onClick={handleGenerate}
                                        disabled={isBusy || isUploadingRefs || !prompt.trim()}
                                        className={`w-full h-12 flex items-center justify-center gap-2 rounded-xl font-semibold transition-all cursor-pointer disabled:cursor-not-allowed ${isBusy
                                            ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-not-allowed shadow-none'
                                            : 'bg-black text-white dark:bg-white dark:text-black shadow-[0_10px_24px_rgba(0,0,0,0.18)] hover:shadow-[0_14px_30px_rgba(0,0,0,0.22)]'
                                            }`}
                                    >
                                        {isBusy ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {tGen('generating')}
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-4 h-4" />
                                                {isUploadingRefs ? '参考图上传中...' : tGen('generate_btn')}
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* History List */}
                                <div className="flex-1 flex flex-col overflow-hidden order-3 border-b border-black/5 dark:border-white/10 bg-transparent">
                                    <div className="px-4 py-2 font-bold text-gray-800 dark:text-zinc-100 flex justify-between items-center text-xs">
                                        {tGen('history')}
                                        <div className="flex items-center gap-3 text-xs font-normal">
                                            <Link
                                                href="/profile"
                                                className="text-zinc-700 dark:text-zinc-300 hover:underline"
                                            >
                                                {_locale === 'zh' ? '查看所有' : 'View all'}
                                            </Link>
                                            <button
                                                onClick={fetchHistory}
                                                className="text-zinc-700 dark:text-zinc-300 hover:underline"
                                            >
                                                {tGen('refresh')}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 relative">
                                        {isFetchingHistory && history.length === 0 ? (
                                            [1, 2, 3].map(i => (
                                                <div key={i} className="flex gap-3 p-2.5 rounded-xl border border-black/5 dark:border-white/10 animate-pulse">
                                                    <div className="w-14 h-14 bg-black/5 dark:bg-white/10 rounded-lg flex-shrink-0" />
                                                    <div className="flex-1 space-y-2 py-1">
                                                        <div className="h-2 bg-black/5 dark:bg-white/10 rounded w-3/4" />
                                                        <div className="h-2 bg-black/5 dark:bg-white/10 rounded w-1/2" />
                                                        <div className="flex justify-between pt-2">
                                                            <div className="h-2 bg-black/5 dark:bg-white/10 rounded w-1/4" />
                                                            <div className="h-2 bg-black/5 dark:bg-white/10 rounded w-1/4" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : historyItems.length === 0 ? (
                                            <div className="h-[200px] flex flex-col items-center justify-center text-gray-400 text-sm">
                                                <Palette className="w-12 h-12 mb-4 text-gray-300" />
                                                {tGen('no_history')}
                                            </div>
                                        ) : (
                                            <>
                                                {isFetchingHistory && (
                                                    <div className="absolute top-0 left-0 right-0 h-[1px] overflow-hidden z-10 pointer-events-none">
                                                        <div className="w-1/2 h-full bg-black animate-[loading_1s_infinite_linear]"
                                                            style={{ backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(to right, transparent, #111827, transparent)' }} />
                                                    </div>
                                                )}
                                                {historyItems.map((entry) => {
                                                    if (entry.type === 'task') {
                                                        return (
                                                            <TaskHistoryItemCard
                                                                key={`task-${entry.task.id}`}
                                                                task={entry.task}
                                                                locale={_locale}
                                                                nowTs={elapsedNow}
                                                                onRetry={() => void handleRetryTask(entry.task)}
                                                            />
                                                        )
                                                    }

                                                    const item = entry.wrap
                                                    return (
                                                        <HistoryItem
                                                            key={`wrap-${item.id}`}
                                                            item={item}
                                                            locale={_locale}
                                                            activeWrapId={activeWrapId}
                                                            getCdnUrl={getCdnUrl}
                                                            getModelName={getModelName}
                                                            onClick={() => {
                                                                const itemCdnUrl = getCdnUrl(item.texture_url)
                                                                let displayUrl = itemCdnUrl
                                                                if (itemCdnUrl && itemCdnUrl.startsWith('http') && !itemCdnUrl.includes(window.location.origin)) {
                                                                    displayUrl = `/api/proxy?url=${encodeURIComponent(itemCdnUrl)}`
                                                                }
                                                                setCurrentTexture(displayUrl)
                                                                setSelectedModel(item.model_slug)
                                                                setActiveWrapId(item.id)
                                                            }}
                                                            onImageClick={(e) => {
                                                                e.stopPropagation()
                                                                const itemCdnUrl = getCdnUrl(item.texture_url)
                                                                let displayUrl = itemCdnUrl
                                                                if (itemCdnUrl && itemCdnUrl.startsWith('http') && !itemCdnUrl.includes(window.location.origin)) {
                                                                    displayUrl = `/api/proxy?url=${encodeURIComponent(itemCdnUrl)}`
                                                                }
                                                                setImagePreviewUrl(displayUrl)
                                                            }}
                                                        />
                                                    )
                                                })}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col gap-4">
                                {/* Model Select for DIY */}
                                <div className="mx-4 mt-4">
                                    <Select
                                        value={selectedModel}
                                        options={sortedModels.map((m: any) => ({
                                            value: m.slug,
                                            label: _locale === 'en' ? (m.name_en || m.name) : m.name
                                        }))}
                                        onChange={(value) => setSelectedModel(value)}
                                        buttonClassName="h-12"
                                    />
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
                    </div >
                </div >
            </div >

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
                wheelUrl={getProxyUrl(models.find(m => m.slug === selectedModel)?.wheelUrl || '', { stable: true })}
                textureUrl={currentTexture || ''}
                isPublishing={isPublishing}
            />

            {/* Image Preview Modal */}
            {imagePreviewUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setImagePreviewUrl(null)}
                >
                    <div className="relative max-w-5xl max-h-[90vh] w-full">
                        <button
                            onClick={() => setImagePreviewUrl(null)}
                            className="absolute -top-12 right-0 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <div className="relative w-full h-full flex items-center justify-center">
                            <Image
                                src={imagePreviewUrl}
                                alt="Preview"
                                width={2048}
                                height={2048}
                                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

function HistoryItem({
    item,
    locale,
    activeWrapId,
    onClick,
    onImageClick,
    getCdnUrl,
    getModelName
}: {
    item: GenerationHistory;
    locale: string;
    activeWrapId: string | null;
    onClick: () => void;
    onImageClick?: (e: React.MouseEvent) => void;
    getCdnUrl: (url: string) => string;
    getModelName: (slug: string) => string;
}) {
    const textureUrl = item.texture_url || '';

    return (
        <div
            onClick={onClick}
            className={`h-[98px] flex gap-3 p-2.5 rounded-lg border transition-all group cursor-pointer bg-white/70 dark:bg-zinc-900/70 backdrop-blur ${activeWrapId === item.id ? 'border-zinc-900 bg-zinc-50' : 'border-black/5 dark:border-white/10 hover:border-black/15 hover:bg-white/90'}`}
        >
            <div
                onClick={onImageClick}
                className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative cursor-zoom-in group/image"
            >
                <ResponsiveOSSImage
                    src={textureUrl}
                    alt="wrap"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-all flex items-center justify-center">
                    <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/image:opacity-100 transition-all drop-shadow-lg" />
                </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-1">
                    <p className="text-xs text-gray-600 dark:text-zinc-400 line-clamp-1 italic flex-1">&quot;{item.prompt}&quot;</p>
                    {item.is_public && (
                        <span className="ml-2 px-1.5 py-0.5 bg-zinc-900/10 text-zinc-700 text-[8px] font-bold rounded uppercase">
                            Public
                        </span>
                    )}
                </div>
                <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-400 uppercase">{getModelName(item.model_slug)}</span>
                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 opacity-0 group-hover:opacity-100 flex items-center gap-1">
                        Apply <ArrowRight className="w-3 h-3" />
                    </span>
                </div>
                <div className="text-[10px] text-gray-400">
                    {formatDateTime(item.created_at, locale)}
                </div>
            </div>
        </div>
    )
}

function TaskHistoryItemCard({
    task,
    locale,
    nowTs,
    onRetry
}: {
    task: GenerationTaskHistory;
    locale: string;
    nowTs: number;
    onRetry: () => void;
}) {
    const isPending = task.status === 'pending' || task.status === 'processing'
    const isFailed = task.status === 'failed' || task.status === 'failed_refunded'
    const isRefunded = task.status === 'failed_refunded'
    const retryStateFromSteps = resolveRetryState(task.status, task.steps || [])
    const isRetrying = isPending && ((typeof task.is_retrying === 'boolean' ? task.is_retrying : retryStateFromSteps.isRetrying))
    const retryStartedAt = task.retry_started_at || retryStateFromSteps.retryStartedAt || task.updated_at
    const progressStartAt = isRetrying ? retryStartedAt : task.created_at
    const elapsedMs = Math.max(0, nowTs - new Date(progressStartAt).getTime())
    const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
    const progress = Math.min(100, (elapsedMs / (ESTIMATED_GENERATE_SECONDS * 1000)) * 100)
    const statusText = isRetrying ? '失败重试中' : (isPending ? '生成中' : (isFailed ? '失败' : task.status))
    const statusClassName = isRetrying
        ? 'bg-amber-200 text-amber-900'
        : (isPending ? 'bg-amber-100 text-amber-700' : (isFailed ? 'bg-rose-100 text-rose-700' : 'bg-zinc-100 text-zinc-700'))
    const elapsedLabel = isRetrying
        ? `重试中 ${elapsedSeconds}s · 预计 ${ESTIMATED_GENERATE_SECONDS}s`
        : `已生成 ${elapsedSeconds}s · 预计 ${ESTIMATED_GENERATE_SECONDS}s`

    return (
        <div className="h-[98px] p-3 rounded-lg border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-gray-700 dark:text-zinc-200 line-clamp-1 italic flex-1">&quot;{task.prompt}&quot;</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusClassName}`}>
                    {statusText}
                </span>
            </div>

            {isPending && (
                <div className="mt-1">
                    <div className="text-[10px] text-gray-500">
                        {elapsedLabel}
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                        <div
                            className="h-full bg-black dark:bg-white relative overflow-hidden transition-[width] duration-100 ease-linear"
                            style={{ width: `${progress}%` }}
                        >
                            <div
                                className="absolute inset-y-0 -left-1/2 w-1/2 animate-[loading_1.2s_infinite_linear]"
                                style={{
                                    backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)',
                                    backgroundSize: '200% 100%'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {isFailed && (
                <div className="mt-1 flex items-center gap-2">
                    <div className="text-[10px] text-rose-600 line-clamp-1 flex-1">
                        失败原因：{task.error_message || '未知错误'}
                    </div>
                    {isRefunded && <span className="text-[10px] text-emerald-600 whitespace-nowrap">积分已退还</span>}
                    <button
                        onClick={onRetry}
                        className="h-6 px-2 rounded-md text-[10px] font-semibold bg-black text-white dark:bg-white dark:text-black flex-shrink-0"
                    >
                        重试
                    </button>
                </div>
            )}

            <div className="text-[10px] text-gray-400">
                {formatDateTime(task.created_at, locale)}
            </div>
        </div>
    )
}
