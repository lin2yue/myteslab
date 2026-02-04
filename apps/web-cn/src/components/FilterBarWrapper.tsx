'use client'

import { useState, ReactNode } from 'react'
import { FilterBar } from './FilterBar'
import type { Model } from '@/lib/types'

interface FilterBarWrapperProps {
    models: Model[]
    children: ReactNode
    sortBy?: 'latest' | 'popular'
}

export function FilterBarWrapper({ models, children, sortBy = 'latest' }: FilterBarWrapperProps) {
    const [isLoading, setIsLoading] = useState(false)

    return (
        <>
            <div className="mb-8">
                <FilterBar models={models} onLoadingChange={setIsLoading} sortBy={sortBy} />
            </div>
            <div className="relative">
                {children}
                {/* Semi-transparent loading overlay on content area */}
                {isLoading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center rounded-lg z-10">
                        <div className="text-center">
                            <div className="relative w-12 h-12 mx-auto mb-3">
                                <div className="absolute inset-0 border-3 border-gray-200 rounded-full"></div>
                                <div className="absolute inset-0 border-3 border-transparent border-t-gray-500 rounded-full animate-spin"></div>
                            </div>
                            <p className="text-sm text-gray-600 font-medium">加载中...</p>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
