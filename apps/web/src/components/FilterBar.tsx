'use client'

import { useTransition, useEffect, useCallback, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { useSearchParams, useParams } from 'next/navigation'
import type { Model } from '@/lib/types'

interface FilterBarProps {
    models: Model[]
    onLoadingChange?: (loading: boolean) => void
    sortBy?: 'latest' | 'popular'
    recommendedKeywords?: string[]
}

export function FilterBar({ models, onLoadingChange, recommendedKeywords = [] }: FilterBarProps) {
    const locale = useLocale()
    const t = useTranslations('Index')
    const router = useRouter()
    const searchParams = useSearchParams()

    const params = useParams()
    const pathModel = params?.slug as string || ''
    const actualModel = pathModel || searchParams.get('model') || ''
    const actualSort = (searchParams.get('sort') as 'latest' | 'popular') || 'latest'
    const actualSearch = (searchParams.get('search') || '').trim()
    const inputRef = useRef<HTMLInputElement>(null)
    const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const closeSuggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [isSuggestOpen, setIsSuggestOpen] = useState(false)
    const [typedQuery, setTypedQuery] = useState(actualSearch)

    const [isPending, startTransition] = useTransition()

    // Notify parent of loading state
    useEffect(() => {
        onLoadingChange?.(isPending)
    }, [isPending, onLoadingChange])

    const updateUrl = useCallback((model: string, sort: string, search: string) => {
        const queryParams = new URLSearchParams()
        if (sort && sort !== 'latest') queryParams.set('sort', sort)
        if (search) queryParams.set('search', search)

        const queryString = queryParams.toString()
        const suffix = queryString ? `?${queryString}` : ''

        if (model) {
            router.push(`/models/${model}${suffix}`)
        } else {
            router.push(`/${suffix}`)
        }
    }, [router])

    useEffect(() => {
        return () => {
            if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current)
            if (closeSuggestTimerRef.current) clearTimeout(closeSuggestTimerRef.current)
        }
    }, [])

    const handleSearchChange = (value: string) => {
        setTypedQuery(value)
        if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current)
        searchDebounceTimerRef.current = setTimeout(() => {
            startTransition(() => {
                updateUrl(actualModel, actualSort, value.trim())
            })
        }, 400)
    }

    const handleModelChange = (value: string) => {
        const currentSearch = inputRef.current?.value?.trim() || actualSearch
        startTransition(() => {
            updateUrl(value, actualSort, currentSearch)
        })
    }

    const handleSortChange = (value: 'latest' | 'popular') => {
        const currentSearch = inputRef.current?.value?.trim() || actualSearch
        startTransition(() => {
            updateUrl(actualModel, value, currentSearch)
        })
    }

    const handleClearSearch = () => {
        if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current)
        if (closeSuggestTimerRef.current) clearTimeout(closeSuggestTimerRef.current)
        if (inputRef.current) inputRef.current.value = ''
        setTypedQuery('')
        startTransition(() => {
            updateUrl(actualModel, actualSort, '')
        })
    }

    const handleSearchFocus = () => {
        if (closeSuggestTimerRef.current) clearTimeout(closeSuggestTimerRef.current)
        setTypedQuery(inputRef.current?.value || actualSearch)
        setIsSuggestOpen(true)
    }

    const handleSearchBlur = () => {
        closeSuggestTimerRef.current = setTimeout(() => {
            setIsSuggestOpen(false)
        }, 120)
    }

    const handleSelectKeyword = (keyword: string) => {
        if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current)
        if (closeSuggestTimerRef.current) clearTimeout(closeSuggestTimerRef.current)
        if (inputRef.current) inputRef.current.value = keyword
        setTypedQuery(keyword)
        setIsSuggestOpen(false)
        startTransition(() => {
            updateUrl(actualModel, actualSort, keyword.trim())
        })
    }

    const normalizedTyped = typedQuery.trim().toLowerCase()
    const suggestionKeywords = recommendedKeywords
        .filter((keyword) => keyword && (!normalizedTyped || keyword.toLowerCase().includes(normalizedTyped)))
        .slice(0, 8)

    return (
        <div className="space-y-4">
            {/* Model Filter */}
            <div className="flex -mx-4 px-4 overflow-x-auto no-scrollbar">
                <div className="inline-flex bg-black/5 dark:bg-white/10 rounded-xl p-1 gap-1 min-w-max backdrop-blur">
                    <button
                        onClick={() => handleModelChange('')}
                        className={`
                            px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                            ${actualModel === ''
                                ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                            }
                        `}
                    >
                        {locale === 'zh' ? '全部车型' : 'All Models'}
                    </button>

                    {models.map((model) => (
                        <button
                            key={model.id}
                            onClick={() => handleModelChange(model.slug)}
                            className={`
                                px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                                ${actualModel === model.slug
                                    ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                                }
                            `}
                    >
                            {locale === 'en' ? model.name_en || model.name : model.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sort + Search */}
            <div className="px-4">
                <div className="flex items-center gap-2">
                    <div className="shrink-0 inline-flex border border-black/5 dark:border-white/10 rounded-lg p-1 gap-1 bg-white/60 dark:bg-zinc-900/50">
                        <button
                            onClick={() => handleSortChange('latest')}
                            className={`
                                px-2.5 sm:px-4 py-1.5 rounded-md text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all
                                ${actualSort === 'latest'
                                    ? 'bg-black/90 text-white'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                                }
                            `}
                        >
                            {t('sort_latest')}
                        </button>
                        <button
                            onClick={() => handleSortChange('popular')}
                            className={`
                                px-2.5 sm:px-4 py-1.5 rounded-md text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all
                                ${actualSort === 'popular'
                                    ? 'bg-black/90 text-white'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                                }
                            `}
                        >
                            {t('sort_popular')}
                        </button>
                    </div>

                    <div className="relative w-[46vw] max-w-[220px] min-w-[136px]">
                        <div className="flex items-center rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur px-3 h-11">
                            <input
                                ref={inputRef}
                                key={`${actualModel}|${actualSort}|${actualSearch}`}
                                type="text"
                                defaultValue={actualSearch}
                                onChange={(event) => handleSearchChange(event.target.value)}
                                onFocus={handleSearchFocus}
                                onBlur={handleSearchBlur}
                                placeholder={locale === 'zh' ? '搜索贴图' : 'Search'}
                                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                            />
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="text-sm leading-none text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white px-1 py-1"
                                aria-label={locale === 'zh' ? '清空搜索' : 'Clear search'}
                            >
                                ×
                            </button>
                        </div>

                        {isSuggestOpen && suggestionKeywords.length > 0 && (
                            <div className="absolute top-[calc(100%+6px)] right-0 z-30 w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur shadow-lg p-2">
                                <p className="text-[11px] text-gray-500 dark:text-zinc-400 px-1.5 pb-1">
                                    {locale === 'zh' ? '热门推荐' : 'Trending'}
                                </p>
                                <div className="flex flex-col gap-1">
                                    {suggestionKeywords.map((keyword) => (
                                        <button
                                            key={keyword}
                                            type="button"
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => handleSelectKeyword(keyword)}
                                            className="text-left text-xs px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-700 dark:text-zinc-200 truncate"
                                            title={keyword}
                                        >
                                            {keyword}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    )
}
