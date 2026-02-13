'use client'

import { useTransition, useEffect, useMemo, useRef } from 'react'
import { useTranslations, useLocale } from '@/lib/i18n'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import type { Model } from '@/lib/types'
import { sortModelsByPreferredOrder } from '@/lib/model-order'

interface FilterBarProps {
    models: Model[]
    onLoadingChange?: (loading: boolean) => void
    sortBy?: 'latest' | 'popular'
}

export function FilterBar({ models, onLoadingChange }: FilterBarProps) {
    const locale = useLocale()
    const t = useTranslations('Index')
    const router = useRouter()
    const searchParams = useSearchParams()

    const params = useParams()
    const pathModel = params?.slug as string || ''
    const actualModel = pathModel || searchParams.get('model') || ''
    const actualSort = (searchParams.get('sort') as 'latest' | 'popular') || 'latest'

    const [isPending, startTransition] = useTransition()
    const sortedModels = useMemo(() => sortModelsByPreferredOrder(models), [models])
    const modelMemoryKey = 'wrap_gallery_last_model'
    const hasHydratedModelMemoryRef = useRef(false)

    // Restore remembered model when URL doesn't specify one
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (actualModel) {
            hasHydratedModelMemoryRef.current = true
            return
        }

        const savedModel = localStorage.getItem(modelMemoryKey)
        if (!savedModel || !sortedModels.some(model => model.slug === savedModel)) {
            hasHydratedModelMemoryRef.current = true
            return
        }

        const queryParams = new URLSearchParams(searchParams.toString())
        const queryString = queryParams.toString()
        const suffix = queryString ? `?${queryString}` : ''
        router.replace(`/models/${savedModel}${suffix}`)
        hasHydratedModelMemoryRef.current = true
    }, [actualModel, sortedModels, searchParams, router])

    // Persist model selection for wrap gallery page (local only)
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!hasHydratedModelMemoryRef.current) return

        if (actualModel) {
            localStorage.setItem(modelMemoryKey, actualModel)
            return
        }
        localStorage.removeItem(modelMemoryKey)
    }, [actualModel])

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
        startTransition(() => {
            updateUrl(value, actualSort)
        })
    }

    const handleSortChange = (value: 'latest' | 'popular') => {
        startTransition(() => {
            updateUrl(actualModel, value)
        })
    }

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

                    {sortedModels.map((model) => (
                        <button
                            key={model.id}
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

            {/* Sort Filter */}
            <div className="w-full">
                <div className="inline-flex items-center rounded-full p-1 border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10">
                    <button
                        onClick={() => handleSortChange('latest')}
                        className={`
                            px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200
                            ${actualSort === 'latest'
                                ? 'bg-white text-gray-900 border border-black/10 shadow-sm dark:bg-zinc-800 dark:text-white dark:border-white/15'
                                : 'text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                            }
                        `}
                    >
                        {t('sort_latest')}
                    </button>
                    <button
                        onClick={() => handleSortChange('popular')}
                        className={`
                            px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200
                            ${actualSort === 'popular'
                                ? 'bg-white text-gray-900 border border-black/10 shadow-sm dark:bg-zinc-800 dark:text-white dark:border-white/15'
                                : 'text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200'
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
