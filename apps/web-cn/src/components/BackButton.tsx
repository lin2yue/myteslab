'use client'

import { useRouter } from 'next/navigation'

interface BackButtonProps {
    fallbackHref: string
    label: string
}

export function BackButton({ fallbackHref, label }: BackButtonProps) {
    const router = useRouter()

    const handleBack = () => {
        if (window.history.length > 1) {
            router.back()
        } else {
            router.push(fallbackHref)
        }
    }

    return (
        <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-medium mr-2"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {label}
        </button>
    )
}
