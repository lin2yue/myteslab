'use client'

import { useState, useTransition, useEffect } from 'react'
import { useTranslations, useLocale } from '@/lib/i18n'
import { useRouter, usePathname } from 'next/navigation'
import { useSearchParams, useParams } from 'next/navigation'
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

    const params = useParams()
    const pathModel = params?.slug as string || ''
    const actualModel = pathModel || searchParams.get('model') || ''
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
        const queryParams = new URLSearchParams()
        if (sort && sort !== 'latest') queryParams.set('sort', sort)

        const queryString = queryParams.toString()
        const suffix = queryString ? `?${queryString}` : ''

        if (model) {
            router.push(`/models/${model}${suffix}`)
        } else {
            router.push(`/${suffix}`)
        }
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
                <div className="inline-flex bg-black/5 dark:bg-white/10 rounded-xl p-1 gap-1 min-w-max backdrop-blur">
                    <button
                        onClick={() => handleModelChange('')}
                        className={`
                            px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                            ${selectedModel === ''
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
                                ${selectedModel === model.slug
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

            {/* Sort Filter */}
            <div className="flex -mx-4 px-4 overflow-x-auto no-scrollbar pb-1">
                <div className="inline-flex border border-black/5 dark:border-white/10 rounded-lg p-1 gap-1 min-w-max bg-white/60 dark:bg-zinc-900/50">
                    <button
                        onClick={() => handleSortChange('latest')}
                        className={`
                            px-4 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all
                            ${selectedSort === 'latest'
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
                            px-4 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all
                            ${selectedSort === 'popular'
                                ? 'bg-black/90 text-white'
                                : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white'
                            }
                        `}
                    >
                        {t('sort_popular')}
                    </button>
                </div>
            </div>
        </div>
    )
}
