'use client'

import { useState, useTransition, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { useSearchParams } from 'next/navigation'
import type { Model } from '@/lib/types'

interface FilterBarProps {
    models: Model[]
    onLoadingChange?: (loading: boolean) => void
    sortBy?: 'latest' | 'popular'
}

export function FilterBar({ models, onLoadingChange, sortBy = 'latest' }: FilterBarProps) {
    const locale = useLocale()
    const t = useTranslations('Index')
    const router = useRouter()
    const searchParams = useSearchParams()

    const actualModel = searchParams.get('model') || ''
    const actualSort = (searchParams.get('sort') as 'latest' | 'popular') || 'latest'

    // Local state for instant UI update
    const [selectedModel, setSelectedModel] = useState(actualModel)
    const [selectedSort, setSelectedSort] = useState(actualSort)
    const [isPending, startTransition] = useTransition()

    // Sync with URL changes
    useEffect(() => {
        setSelectedModel(actualModel)
        setSelectedSort(actualSort)
    }, [actualModel, actualSort])

    // Notify parent of loading state
    useEffect(() => {
        onLoadingChange?.(isPending)
    }, [isPending, onLoadingChange])

    const updateUrl = (model: string, sort: string) => {
        const params = new URLSearchParams()
        if (model) params.set('model', model)
        if (sort && sort !== 'latest') params.set('sort', sort)

        const queryString = params.toString()
        router.push(queryString ? `/?${queryString}` : '/')
    }

    const handleModelChange = (value: string) => {
        setSelectedModel(value)
        startTransition(() => {
            updateUrl(value, selectedSort)
        })
    }

    const handleSortChange = (value: 'latest' | 'popular') => {
        setSelectedSort(value)
        startTransition(() => {
            updateUrl(selectedModel, value)
        })
    }

    return (
        <div className="space-y-4">
            {/* Model Filter */}
            <div className="flex -mx-4 px-4 overflow-x-auto no-scrollbar">
                <div className="inline-flex bg-gray-100/50 dark:bg-zinc-800/50 rounded-xl p-1 gap-1 min-w-max">
                    <button
                        onClick={() => handleModelChange('')}
                        className={`
                            px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                            ${selectedModel === ''
                                ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
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
                                ${selectedModel === model.slug
                                    ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                                }
                            `}
                        >
                            {locale === 'en' ? model.name_en || model.name : model.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sort Filter */}
            <div className="flex -mx-4 px-4 overflow-x-auto no-scrollbar pb-1">
                <div className="inline-flex bg-gray-100/50 dark:bg-zinc-800/50 rounded-xl p-1 gap-1 min-w-max">
                    <button
                        onClick={() => handleSortChange('latest')}
                        className={`
                            px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5
                            ${selectedSort === 'latest'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                            }
                        `}
                    >
                        <span className="text-[10px]">✨</span>
                        {t('sort_latest')}
                    </button>
                    <button
                        onClick={() => handleSortChange('popular')}
                        className={`
                            px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5
                            ${selectedSort === 'popular'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                            }
                        `}
                    >
                        <span className="text-[10px]">🔥</span>
                        {t('sort_popular')}
                    </button>
                </div>
            </div>
        </div>
    )
}
