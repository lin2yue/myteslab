'use client'

import { useTransition, useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslations, useLocale } from '@/lib/i18n'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import type { Model } from '@/lib/types'
import { sortModelsByPreferredOrder } from '@/lib/model-order'
import type { WrapSortBy } from '@/lib/api'

interface FilterBarProps {
    models: Model[]
    onLoadingChange?: (loading: boolean) => void
    sortBy?: WrapSortBy
    recommendedKeywords?: string[]
}

function safeSessionGet(key: string): string | null {
    try {
        return sessionStorage.getItem(key)
    } catch {
        return null
    }
}

function safeSessionSet(key: string, value: string) {
    try {
        sessionStorage.setItem(key, value)
    } catch {
        // ignore storage write failures (private mode / restricted WebView)
    }
}

function safeLocalGet(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function safeLocalSet(key: string, value: string) {
    try {
        localStorage.setItem(key, value)
    } catch {
        // ignore storage write failures (private mode / restricted WebView)
    }
}

function safeLocalRemove(key: string) {
    try {
        localStorage.removeItem(key)
    } catch {
        // ignore storage write failures (private mode / restricted WebView)
    }
}

export function FilterBar({ models, onLoadingChange, recommendedKeywords = [] }: FilterBarProps) {
    const locale = useLocale()
    const t = useTranslations('Index')
    const router = useRouter()
    const searchParams = useSearchParams()

    const params = useParams()
    const pathModel = params?.slug as string || ''
    const actualModel = pathModel || searchParams.get('model') || ''
    const sortParam = searchParams.get('sort')
    const actualSort: WrapSortBy = sortParam === 'popular' || sortParam === 'latest' || sortParam === 'recommended'
        ? sortParam
        : 'recommended'
    const actualSearch = (searchParams.get('search') || '').trim()

    const [isPending, startTransition] = useTransition()
    const [searchInput, setSearchInput] = useState(actualSearch)
    const [isSuggestOpen, setIsSuggestOpen] = useState(false)
    const sortedModels = useMemo(() => sortModelsByPreferredOrder(models), [models])
    const modelMemoryKey = 'wrap_gallery_last_model'
    const hydrationKey = 'has_restored_model_session'

    // Restore remembered model when URL doesn't specify one
    useEffect(() => {
        if (typeof window === 'undefined') return

        // Check if we already handled hydration in this session
        const hasRestored = safeSessionGet(hydrationKey)
        if (hasRestored) return

        if (actualModel) {
            safeSessionSet(hydrationKey, 'true')
            return
        }

        const savedModel = safeLocalGet(modelMemoryKey)
        if (!savedModel || !sortedModels.some(model => model.slug === savedModel)) {
            safeSessionSet(hydrationKey, 'true')
            return
        }

        const queryParams = new URLSearchParams(searchParams.toString())
        const queryString = queryParams.toString()
        const suffix = queryString ? `?${queryString}` : ''

        // Mark as restored BEFORE redirect to prevent infinite loops if something fails
        safeSessionSet(hydrationKey, 'true')
        router.replace(`/models/${savedModel}${suffix}`)
    }, [actualModel, sortedModels, searchParams, router])

    // Persist model selection for wrap gallery page (local only)
    useEffect(() => {
        if (typeof window === 'undefined') return

        if (actualModel) {
            safeLocalSet(modelMemoryKey, actualModel)
            return
        }
        safeLocalRemove(modelMemoryKey)
    }, [actualModel])

    // Notify parent of loading state
    useEffect(() => {
        onLoadingChange?.(isPending)
    }, [isPending, onLoadingChange])

    // Sync controlled search input with URL state
    useEffect(() => {
        setSearchInput(actualSearch)
    }, [actualSearch])

    const updateUrl = useCallback((model: string, sort: WrapSortBy, search: string) => {
        const queryParams = new URLSearchParams()
        if (sort !== 'recommended') queryParams.set('sort', sort)
        if (search) queryParams.set('search', search)

        const queryString = queryParams.toString()
        const suffix = queryString ? `?${queryString}` : ''

        if (model) {
            router.push(`/models/${model}${suffix}`)
        } else {
            router.push(`/${suffix}`)
        }
    }, [router])

    // Debounced keyword search
    useEffect(() => {
        const normalizedInput = searchInput.trim()
        if (normalizedInput === actualSearch) return

        const timer = setTimeout(() => {
            startTransition(() => {
                updateUrl(actualModel, actualSort, normalizedInput)
            })
        }, 400)

        return () => clearTimeout(timer)
    }, [searchInput, actualSearch, actualModel, actualSort, startTransition, updateUrl])

    const handleModelChange = (value: string) => {
        startTransition(() => {
            updateUrl(value, actualSort, searchInput.trim())
        })
    }

    const handleSortChange = (value: WrapSortBy) => {
        startTransition(() => {
            updateUrl(actualModel, value, searchInput.trim())
        })
    }

    const handleSelectKeyword = (keyword: string) => {
        setSearchInput(keyword)
        setIsSuggestOpen(false)
        startTransition(() => {
            updateUrl(actualModel, actualSort, keyword.trim())
        })
    }

    const normalizedTyped = searchInput.trim().toLowerCase()
    const suggestionKeywords = recommendedKeywords
        .filter((keyword) => keyword && (!normalizedTyped || keyword.toLowerCase().includes(normalizedTyped)))
        .slice(0, 8)

    return (
        <div className="space-y-4">
            {/* Model Filter */}
            <div className="w-full">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => handleModelChange('')}
                        className={`
                            px-4 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-all duration-200
                            ${actualModel === ''
                                ? 'bg-black text-white border-black shadow-[0_8px_18px_rgba(0,0,0,0.12)] dark:bg-white dark:text-black dark:border-white'
                                : 'bg-white/85 text-gray-700 border-black/10 hover:bg-white hover:border-black/20 dark:bg-zinc-900/45 dark:text-zinc-300 dark:border-white/15 dark:hover:bg-zinc-800/70 dark:hover:border-white/30'
                            }
                        `}
                    >
                        {locale === 'zh' ? '全部车型' : 'All Models'}
                    </button>

                    {sortedModels.map((model, index) => (
                        <button
                            key={`${model.slug || 'model'}-${model.id || 'noid'}-${index}`}
                            onClick={() => handleModelChange(model.slug)}
                            className={`
                                px-4 py-2 rounded-full border text-sm font-semibold whitespace-nowrap transition-all duration-200
                                ${actualModel === model.slug
                                    ? 'bg-black text-white border-black shadow-[0_8px_18px_rgba(0,0,0,0.12)] dark:bg-white dark:text-black dark:border-white'
                                    : 'bg-white/85 text-gray-700 border-black/10 hover:bg-white hover:border-black/20 dark:bg-zinc-900/45 dark:text-zinc-300 dark:border-white/15 dark:hover:bg-zinc-800/70 dark:hover:border-white/30'
                                }
                            `}
                        >
                            {locale === 'en' ? model.name_en || model.name : model.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sort + Search */}
            <div className="w-full">
                <div className="flex items-center gap-2">
                    <div className="shrink-0 inline-flex items-center rounded-full p-1 border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10">
                        <button
                            onClick={() => handleSortChange('recommended')}
                            className={`
                                px-2.5 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-200
                                ${actualSort === 'recommended'
                                    ? 'bg-white text-gray-900 border border-black/10 shadow-sm dark:bg-zinc-800 dark:text-white dark:border-white/15'
                                    : 'text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                                }
                            `}
                        >
                            {t('sort_recommended')}
                        </button>
                        <button
                            onClick={() => handleSortChange('popular')}
                            className={`
                                px-2.5 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-200
                                ${actualSort === 'popular'
                                    ? 'bg-white text-gray-900 border border-black/10 shadow-sm dark:bg-zinc-800 dark:text-white dark:border-white/15'
                                    : 'text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                                }
                            `}
                        >
                            {t('sort_popular')}
                        </button>
                        <button
                            onClick={() => handleSortChange('latest')}
                            className={`
                                px-2.5 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-200
                                ${actualSort === 'latest'
                                    ? 'bg-white text-gray-900 border border-black/10 shadow-sm dark:bg-zinc-800 dark:text-white dark:border-white/15'
                                    : 'text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                                }
                            `}
                        >
                            {t('sort_latest')}
                        </button>
                    </div>

                    <div className="relative w-[46vw] max-w-[220px] min-w-[136px]">
                        <div className="flex items-center rounded-xl border border-black/10 dark:border-white/15 bg-white/85 dark:bg-zinc-900/45 px-3 h-11">
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                onFocus={() => setIsSuggestOpen(true)}
                                onBlur={() => setTimeout(() => setIsSuggestOpen(false), 120)}
                                placeholder={locale === 'zh' ? '搜索贴图' : 'Search'}
                                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchInput('')
                                        startTransition(() => {
                                            updateUrl(actualModel, actualSort, '')
                                        })
                                    }}
                                    className="text-sm leading-none text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white px-1 py-1"
                                    aria-label={locale === 'zh' ? '清空搜索' : 'Clear search'}
                                >
                                    ×
                                </button>
                            )}
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
