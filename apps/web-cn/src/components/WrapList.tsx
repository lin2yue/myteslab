'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { WrapCard } from './WrapCard'
import { fetchMoreWraps } from '@/lib/actions'
import type { Wrap } from '@/lib/types'
import type { WrapSortBy } from '@/lib/api'
import { useTranslations } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import {
    asString,
    canDisplayCampaign,
    ensureViewerKey,
    markCampaignDisplayed,
    type OperationCampaign,
} from '@/components/operations/client-utils'

interface WrapListProps {
    initialWraps: Wrap[]
    model?: string
    locale: string
    sortBy?: WrapSortBy
    searchQuery?: string
}

const PAGE_SIZE = 15

export function WrapList({ initialWraps, model, locale, sortBy = 'recommended', searchQuery = '' }: WrapListProps) {
    const router = useRouter()
    const [wraps, setWraps] = useState<Wrap[]>(initialWraps)
    const [slotCampaign, setSlotCampaign] = useState<OperationCampaign | null>(null)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(initialWraps.length >= PAGE_SIZE)
    const loaderRef = useRef<HTMLDivElement>(null)
    const t = useTranslations('Index')

    // 当模型过滤或排序改变时重置状态
    useEffect(() => {
        setWraps(initialWraps)
        setPage(1)
        setHasMore(initialWraps.length >= PAGE_SIZE)
    }, [initialWraps, model, sortBy, searchQuery])

    useEffect(() => {
        let disposed = false
        const load = async () => {
            const viewerKey = ensureViewerKey()
            const res = await fetch(`/api/operations/placement?placement=wrap_list_slot&viewerKey=${encodeURIComponent(viewerKey)}`, {
                cache: 'no-store',
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data?.success || !data?.campaign) return
            const next = data.campaign as OperationCampaign
            if (!canDisplayCampaign(next)) return
            if (disposed) return
            setSlotCampaign(next)
            markCampaignDisplayed(next)
        }
        load().catch(() => {})
        return () => {
            disposed = true
        }
    }, [model, sortBy, searchQuery])

    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return

        setLoading(true)
        const nextPage = page + 1

        try {
            const newWraps = await fetchMoreWraps(model, nextPage, sortBy, searchQuery)
            if (newWraps.length > 0) {
                setWraps(prev => {
                    // 过滤重复
                    const existingIds = new Set(prev.map(w => w.id))
                    const filteredNew = newWraps.filter(w => !existingIds.has(w.id))
                    return [...prev, ...filteredNew]
                })
                setPage(nextPage)

                // 如果返回的数量少于一页大小，说明没有更多了
                if (newWraps.length < PAGE_SIZE) {
                    setHasMore(false)
                }
            } else {
                setHasMore(false)
            }
        } catch (error) {
            console.error('加载更多失败:', error)
        } finally {
            setLoading(false)
        }
    }, [loading, hasMore, page, model, sortBy, searchQuery])

    // 无限滚动逻辑
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            const first = entries[0]
            if (first.isIntersecting && !loading && hasMore) {
                loadMore()
            }
        }, { threshold: 0.1 })

        const currentLoader = loaderRef.current
        if (currentLoader) {
            observer.observe(currentLoader)
        }

        return () => {
            if (currentLoader) {
                observer.unobserve(currentLoader)
            }
        }
    }, [loadMore, loading, hasMore])

    if (wraps.length === 0) {
        return (
            <div className="text-center py-24">
                <div className="text-7xl mb-6">🎨</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {t('no_wraps')}
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                    {searchQuery
                        ? (locale === 'zh' ? '未找到匹配的贴图，试试其他关键词。' : 'No matching wraps found. Try different keywords.')
                        : model
                        ? (locale === 'zh' ? '该车型暂无可用贴图，快去尝试 AI 生成一个吧！' : 'No wraps available for this model. Try generating one with AI!')
                        : (locale === 'zh' ? '请先在数据库中添加贴图数据' : 'Please add wrap data to the database first')}
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-6 gap-y-10">
                {slotCampaign ? (
                    <button
                        type="button"
                        onClick={() => {
                            const actionType = asString(slotCampaign.action_config?.type, 'none')
                            const target = asString(slotCampaign.action_config?.target)
                            if (actionType === 'internal_link' && target) {
                                router.push(target)
                                return
                            }
                            if (actionType === 'external_link' && target) {
                                window.open(target, '_blank', 'noopener,noreferrer')
                            }
                        }}
                        className="text-left bg-white/85 dark:bg-zinc-900/80 rounded-2xl overflow-hidden border border-amber-200/70 dark:border-amber-900/40 hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_16px_36px_rgba(0,0,0,0.10)] transition-all duration-300 h-full"
                    >
                        <div className="aspect-[4/3] bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 flex items-center justify-center px-5">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-800/80">Sponsored</p>
                                <h3 className="mt-2 text-2xl font-black text-amber-950 leading-tight line-clamp-3">
                                    {asString(slotCampaign.content?.title, slotCampaign.name || '活动进行中')}
                                </h3>
                            </div>
                        </div>
                        <div className="p-4 space-y-2">
                            <p className="text-sm text-zinc-700 dark:text-zinc-200 line-clamp-2">
                                {asString(slotCampaign.content?.description, asString(slotCampaign.content?.subtitle, '点击查看活动详情'))}
                            </p>
                            <span className="inline-flex rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">
                                {asString(slotCampaign.content?.cta_text, '立即参与')}
                            </span>
                        </div>
                    </button>
                ) : null}
                {wraps.map((wrap) => (
                    <WrapCard key={wrap.id} wrap={wrap} source={model ? 'model' : 'all'} />
                ))}
            </div>

            {/* 加载触发器 */}
            <div
                ref={loaderRef}
                className={`py-12 flex justify-center transition-opacity duration-300 ${hasMore ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                {loading && (
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
                )}
                {!loading && hasMore && (
                    <div className="h-10" /> // 占位符以便触发观察
                )}
            </div>
        </div>
    )
}
