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
    Sparkles, X, Plus, Palette, ArrowRight
} from 'lucide-react'
import PricingModal from '@/components/pricing/PricingModal'
import { useRouter } from '@/i18n/routing'
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage'
import PublishModal from '@/components/publish/PublishModal'
import { useAlert } from '@/components/alert/AlertProvider'
import { ServiceType, getServiceCost } from '@/lib/constants/credits'
import { useCredits } from '@/components/credits/CreditsProvider'
import Select from '@/components/ui/Select'
import { createModelNameResolver } from '@/lib/model-display'

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
    models: Array<{ slug: string; name: string; name_en?: string; modelUrl?: string; wheelUrl?: string }>,
    locale: string,
    isLoggedIn: boolean
}) {
    const t = useTranslations('Common')
    const tIndex = useTranslations('Index')
    const tGen = useTranslations('Generator')
    const alert = useAlert()
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'
    const getModelName = useMemo(() => createModelNameResolver(models, _locale), [models, _locale])

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

    // 从 localStorage 读取上次选择的模型
    const getInitialModel = () => {
        if (typeof window === 'undefined') return models[0]?.slug || 'cybertruck'

        const savedModel = localStorage.getItem('ai_generator_last_model')
        // 验证保存的模型是否仍然存在于当前模型列表中
        if (savedModel && models.some(m => m.slug === savedModel)) {
            return savedModel
        }
        return models[0]?.slug || 'cybertruck'
    }

    const { balance, setBalance, refresh: refreshCredits } = useCredits()
    const [selectedModel, setSelectedModel] = useState(getInitialModel())
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
    const [pendingTaskId, setPendingTaskId] = useState<string | null>(null)
    const [isUploadingRefs, setIsUploadingRefs] = useState(false)
    const pollAttemptsRef = useRef(0)
    const pollStartRef = useRef<number | null>(null)
    const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // 3D 控制状态
    const [isNight, setIsNight] = useState(false)
    const [autoRotate, setAutoRotate] = useState(true)
    const viewerRef = useRef<ModelViewerRef>(null)
    const isFetchingRef = useRef(false)
    const [isLoggedInInternal, setIsLoggedInInternal] = useState(isLoggedIn)

    // 当模型改变时保存到 localStorage
    useEffect(() => {
        if (typeof window !== 'undefined' && selectedModel) {
            localStorage.setItem('ai_generator_last_model', selectedModel)
        }
    }, [selectedModel])

    // Sync internal login state with prop
    useEffect(() => {
        setIsLoggedInInternal(isLoggedIn)
    }, [isLoggedIn])

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
            }
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [fetchHistory, supabase])

    useEffect(() => {
        if (!pendingTaskId) return
        let isActive = true
        pollAttemptsRef.current = 0
        pollStartRef.current = Date.now()

        const poll = (delayMs: number) => {
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
            pollTimeoutRef.current = setTimeout(async () => {
                if (!isActive) return
                const elapsedMs = Date.now() - (pollStartRef.current || Date.now())
                if (pollAttemptsRef.current >= 24 || elapsedMs > 3 * 60 * 1000) {
                    alert.info('生成可能仍在后台进行，请稍后刷新历史查看结果')
                    setPendingTaskId(null)
                    return
                }
                pollAttemptsRef.current += 1
                try {
                    const res = await fetch('/api/wrap/by-task', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ taskId: pendingTaskId })
                    })

                    const retryAfterHeader = res.headers.get('Retry-After')
                    const baseDelay = retryAfterHeader ? Number(retryAfterHeader) * 1000 : delayMs

                    if (!res.ok) {
                        if (res.status === 429) {
                            poll(baseDelay || 5000)
                        } else {
                            poll(5000)
                        }
                        return
                    }
                    const data = await res.json()
                    if (data?.wrap?.id) {
                        setCurrentTexture(data.wrap.preview_url || data.wrap.texture_url)
                        setActiveWrapId(data.wrap.id)
                        setPendingTaskId(null)
                        fetchHistory()
                        return
                    }

                    if (data?.status === 'failed') {
                        alert.error(`生成失败: ${data.error || '任务失败'}`)
                        setPendingTaskId(null)
                        return
                    }

                    if (data?.status === 'completed_missing') {
                        alert.error('任务已完成但未找到结果，请稍后刷新或联系客服')
                        setPendingTaskId(null)
                        return
                    }

                    const nextBase = (data?.retryAfter || 5) * 1000
                    const nextDelay = Math.min(30000, Math.round(nextBase * Math.pow(1.4, pollAttemptsRef.current)))
                    poll(nextDelay)
                } catch (err) {
                    console.error('Polling wrap by task id failed:', err)
                    poll(5000)
                }
            }, delayMs)
        }

        poll(5000)

        return () => {
            isActive = false
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
        }
    }, [pendingTaskId, fetchHistory])

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

        const requiredCredits = getServiceCost(ServiceType.AI_GENERATION)
        const currentBalance = balance ?? 0
        if (currentBalance < requiredCredits) {
            alert.warning(`积分不足，需要 ${requiredCredits} 积分，当前余额 ${currentBalance}`)
            setShowPricing(true)
            return
        }

        setIsGenerating(true)
        try {
            // Check payload size estimate
            const payload = JSON.stringify({
                modelSlug: selectedModel,
                prompt: prompt.trim(),
                referenceImages: referenceImages
            });

            if (payload.length > 4 * 1024 * 1024) { // 4MB safety limit
                throw new Error(`参考图片总数据量过大 (${(payload.length / 1024 / 1024).toFixed(2)} MB)，请减少图片数量或更换更小的图片`);
            }

            console.log(`[AI-GEN] Requesting with payload size: ${(payload.length / 1024).toFixed(2)} KB`);

            const res = await fetch('/api/wrap/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            })

            if (!res.ok) {
                if (res.status === 413) {
                    throw new Error(`上传的图片过大 (Payload: ${(payload.length / 1024 / 1024).toFixed(2)} MB)，服务器拒绝接收`);
                }
                if (res.status === 504) {
                    throw new Error('服务器超时，任务可能在后台继续执行，请稍后刷新历史记录查看结果');
                }

                let errorMessage = `请求失败 (${res.status})`;
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    const text = await res.text();
                    if (text) errorMessage = `${errorMessage}: ${text.substring(0, 50)}`;
                }
                throw new Error(errorMessage);
            }

            const data = await res.json()
            if (!data.success) throw new Error(data.error)

            if (data.status === 'pending') {
                setPendingTaskId(data.taskId)
                alert.info('任务已提交，正在后台生成，完成后会自动刷新')
                return
            }

            setCurrentTexture(data.image.dataUrl) // 服务器已经返回了纠正后的贴图
            setActiveWrapId(data.wrapId) // 使用作品 ID 而非任务 ID

            // 更新余额
            setBalance(data.remainingBalance)
            refreshCredits()

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
        <div className="flex flex-col h-auto lg:h-[calc(100vh-64px)] bg-transparent overflow-y-auto lg:overflow-hidden">
            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-visible lg:overflow-hidden w-full mx-auto">

                {/* Left Side: 3D Preview (65%) */}
                <div className="flex-none lg:flex-[6.5] flex flex-col p-0 overflow-hidden bg-white/60 dark:bg-zinc-950/40 backdrop-blur">
                    <div className="h-[50vh] lg:flex-1 relative overflow-hidden m-4 rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/60 shadow-[0_12px_30px_rgba(0,0,0,0.12)] backdrop-blur">
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
                    <div className="flex flex-row items-center px-6 py-4 border-t border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-950/80 gap-2 overflow-x-auto backdrop-blur" >
                        <button
                            onClick={() => setIsNight(!isNight)}
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
                            disabled={isPublishing || isSaving || (activeMode === 'ai' && !activeWrapId) || (activeMode === 'diy' && !currentTexture) || (activeWrapId ? history.find(h => h.id === activeWrapId)?.is_public : false)}
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
                            className={`flex-1 h-12 font-bold transition-all text-base tracking-tight relative ${activeMode === 'ai' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {tGen('mode_ai')}
                            {activeMode === 'ai' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
                        </button>
                        <button
                            onClick={() => {
                                setActiveMode('diy');
                                setCurrentTexture(null);
                                setActiveWrapId(null);
                            }}
                            className={`flex-1 h-12 font-bold transition-all text-base tracking-tight relative ${activeMode === 'diy' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {tGen('mode_diy')}
                            {activeMode === 'diy' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
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
                                            options={models.map((m: any) => ({
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

                                    <div className="flex-[2] flex items-center gap-2 h-12 bg-white/90 dark:bg-zinc-900/70 border border-black/10 dark:border-white/10 rounded-xl px-2.5">
                                        <div className="flex items-baseline gap-2 min-w-0">
                                            <span className="text-[11px] text-gray-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                                                {tGen('balance_label')}
                                            </span>
                                            <span className="text-base font-semibold text-gray-900 dark:text-white truncate">
                                                {isLoggedInInternal ? (balance ?? 0) : tGen('login_to_view')}
                                            </span>
                                            <span className="text-[10px] text-gray-400 dark:text-zinc-400 uppercase tracking-wide">
                                                {tGen('credits_label')}
                                            </span>
                                        </div>
                                        <div className="flex-1" />
                                        <button
                                            onClick={handleBuyCredits}
                                            className="btn-secondary h-9 px-3 text-xs whitespace-nowrap"
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
                                        disabled={isGenerating || isUploadingRefs || !prompt.trim()}
                                        className={`w-full btn-primary h-12 flex items-center justify-center gap-2 ${isGenerating ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' : ''}`}
                                    >
                                        {isGenerating ? (
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
                                        <button onClick={fetchHistory} className="text-xs text-zinc-700 font-normal hover:underline">{tGen('refresh')}</button>
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
                                        ) : history.length === 0 ? (
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
                                                {history.map((item) => (
                                                    <HistoryItem
                                                        key={item.id}
                                                        item={item}
                                                        activeWrapId={activeWrapId}
                                                        getCdnUrl={getCdnUrl}
                                                        getModelName={getModelName}
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
                            <div className="h-full flex flex-col gap-4">
                                {/* Model Select for DIY */}
                                <div className="mx-4 mt-4">
                                    <Select
                                        value={selectedModel}
                                        options={models.map((m: any) => ({
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
        </div >
    );
}

function HistoryItem({
    item,
    activeWrapId,
    onClick,
    getCdnUrl,
    getModelName
}: {
    item: GenerationHistory;
    activeWrapId: string | null;
    onClick: () => void;
    getCdnUrl: (url: string) => string;
    getModelName: (slug: string) => string;
}) {
    const textureUrl = item.texture_url || '';

    return (
        <div
            onClick={onClick}
            className={`flex gap-3 p-2.5 rounded-lg border transition-all group cursor-pointer bg-white/70 dark:bg-zinc-900/70 backdrop-blur ${activeWrapId === item.id ? 'border-zinc-900 bg-zinc-50' : 'border-black/5 dark:border-white/10 hover:border-black/15 hover:bg-white/90'}`}
        >
            <div
                className="w-14 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0"
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
                        <span className="ml-2 px-1.5 py-0.5 bg-zinc-900/10 text-zinc-700 text-[8px] font-bold rounded uppercase">
                            Public
                        </span>
                    )}
                </div>
                <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-gray-400 uppercase">{getModelName(item.model_slug)}</span>
                    <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 flex items-center gap-1">
                        Apply <ArrowRight className="w-3 h-3" />
                    </span>
                </div>
            </div>
        </div>
    );
}
