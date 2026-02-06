'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * 百度自动推送组件
 * 在页面加载时自动向百度提交 URL,加快索引速度
 */
export function BaiduPush() {
    const pathname = usePathname()

    useEffect(() => {
        // 百度自动推送代码
        if (typeof window !== 'undefined') {
            const bp = document.createElement('script')
            bp.src = 'https://zz.bdstatic.com/linksubmit/push.js'
            const s = document.getElementsByTagName('script')[0]
            s.parentNode?.insertBefore(bp, s)
        }
    }, [pathname])

    return null
}
