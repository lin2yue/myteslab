'use client'

import { ReactNode } from 'react'

interface WrapListContainerProps {
    children: ReactNode
    isLoading?: boolean
}

export function WrapListContainer({ children, isLoading }: WrapListContainerProps) {
    return (
        <div className="relative min-h-[400px]">
            {children}

            {/* Loading Overlay - Only on list area */}
            {isLoading && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-lg">
                    <div className="text-center">
                        <div className="relative w-14 h-14 mx-auto mb-3">
                            <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-transparent border-t-gray-600 rounded-full animate-spin"></div>
                        </div>
                        <p className="text-gray-600 font-medium">加载中...</p>
                    </div>
                </div>
            )}
        </div>
    )
}
