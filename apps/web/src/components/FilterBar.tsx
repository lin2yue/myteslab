'use client'

import { useState, useTransition, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { useSearchParams } from 'next/navigation'
import type { Model } from '@/lib/types'

interface FilterBarProps {
    models: Model[]
    onLoadingChange?: (loading: boolean) => void
}

export function FilterBar({ models, onLoadingChange }: FilterBarProps) {
    const locale = useLocale()
    const t = useTranslations('Index')
    const router = useRouter()
    const searchParams = useSearchParams()
    const actualModel = searchParams.get('model') || 'model-3-2024'

    // Local state for instant UI update
    const [selectedModel, setSelectedModel] = useState(actualModel)
    const [isPending, startTransition] = useTransition()

    // Sync with URL changes
    useEffect(() => {
        setSelectedModel(actualModel)
    }, [actualModel])

    // Notify parent of loading state
    useEffect(() => {
        onLoadingChange?.(isPending)
    }, [isPending, onLoadingChange])

    const handleModelChange = (value: string) => {
        // Immediate UI update
        setSelectedModel(value)

        // Async router update
        startTransition(() => {
            if (value === 'model-3-2024') {
                router.push('/')
            } else {
                router.push(`/?model=${value}`)
            }
        })
    }

    return (
        <div className="mb-6">
            {/* Capsule-style tab container */}
            <div className="inline-flex bg-gray-100 rounded-full p-1 gap-1">
                {/* All Models Tab */}
                <button
                    onClick={() => handleModelChange('model-3-2024')}
                    className={`
                        px-6 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                        ${selectedModel === 'model-3-2024'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }
                    `}
                >
                    {locale === 'zh' ? '全部车型' : 'All Models'}
                </button>

                {/* Individual Model Tabs */}
                {models.map((model) => (
                    <button
                        key={model.id}
                        onClick={() => handleModelChange(model.slug)}
                        className={`
                            px-6 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                            ${selectedModel === model.slug
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }
                        `}
                    >
                        {locale === 'en' ? model.name_en || model.name : model.name}
                    </button>
                ))}
            </div>
        </div>
    )
}
