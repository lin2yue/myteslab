'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { WrapCard } from './WrapCard'
import { fetchMoreWraps } from '@/lib/actions'
import type { Wrap } from '@/lib/types'
import { useTranslations } from 'next-intl'

interface WrapListProps {
    initialWraps: Wrap[]
    model?: string
    locale: string
    sortBy?: 'latest' | 'popular'
    searchQuery?: string
}

const PAGE_SIZE = 12

export function WrapList({ initialWraps, model, locale, sortBy = 'latest', searchQuery = '' }: WrapListProps) {
    const [wraps, setWraps] = useState<Wrap[]>(initialWraps)
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
