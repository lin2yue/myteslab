'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

export default function BatchRefreshPage() {
    const router = useRouter()
    const locale = useLocale()

    useEffect(() => {
        router.replace(`/${locale}/admin/wraps`)
    }, [locale, router])

    return (
        <div className="p-10 text-center text-sm text-gray-500">
            Batch Refresh has moved to Works. Redirecting...
        </div>
    )
}
