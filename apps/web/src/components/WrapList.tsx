'use client'

import { useState, useEffect } from 'react'
import { WrapCard } from './WrapCard'
import { fetchMoreWraps } from '@/lib/actions'
import type { Wrap } from '@/lib/types'
import { useTranslations } from 'next-intl'

interface WrapListProps {
    initialWraps: Wrap[]
    model?: string
    locale: string
    sortBy?: 'latest' | 'popular'
}

const PAGE_SIZE = 12

export function WrapList({ initialWraps, model, locale, sortBy = 'latest' }: WrapListProps) {
    const [wraps, setWraps] = useState<Wrap[]>(initialWraps)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(initialWraps.length >= PAGE_SIZE)
    const t = useTranslations('Index')

    // 当模型过滤或排序改变时重置状态
    useEffect(() => {
        setWraps(initialWraps)
        setPage(1)
        setHasMore(initialWraps.length >= PAGE_SIZE)
    }, [initialWraps, model, sortBy])

    const loadMore = async () => {
        if (loading || !hasMore) return

        setLoading(true)
        const nextPage = page + 1

        try {
            const newWraps = await fetchMoreWraps(model, nextPage, sortBy)
            if (newWraps.length > 0) {
                setWraps(prev => [...prev, ...newWraps])
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
    }

    if (wraps.length === 0) {
        return (
            <div className="text-center py-16">
                <div className="text-6xl mb-4">🎨</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {t('no_wraps')}
                </h3>
                <p className="text-gray-600">
                    {model
                        ? (locale === 'zh' ? '该车型暂无可用贴图' : 'No wraps available for this model')
                        : (locale === 'zh' ? '请先在数据库中添加贴图数据' : 'Please add wrap data to the database first')}
                </p>
            </div>
        )
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {wraps.map((wrap) => (
                    <WrapCard key={wrap.id} wrap={wrap} />
                ))}
            </div>

            {hasMore && (
                <div className="mt-12 flex justify-center">
                    <button
                        onClick={loadMore}
                        disabled={loading}
                        className="px-8 py-3 bg-white border border-gray-200 rounded-full shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {locale === 'zh' ? '加载中...' : 'Loading...'}
                            </>
                        ) : (
                            <>
                                <span>{locale === 'zh' ? '加载更多' : 'Load More'}</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </>
                        )}
                    </button>
                </div>
            )}
        </>
    )
}
