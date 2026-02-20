'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BatchRefreshPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/admin/wraps')
    }, [router])

    return (
        <div className="p-10 text-center text-sm text-gray-500">
            Batch Refresh has moved to Works. Redirecting...
        </div>
    )
}
