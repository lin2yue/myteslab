'use client'

import { useEffect } from 'react'

/**
 * 百度自动推送组件
 * 在页面加载时自动向百度提交 URL,加快索引速度
 */
export function BaiduPush() {
    useEffect(() => {
        // 百度自动推送代码
        if (typeof window !== 'undefined') {
            if (document.querySelector('script[data-baidu-push="1"]')) {
                return
            }
            const bp = document.createElement('script')
            bp.src = 'https://zz.bdstatic.com/linksubmit/push.js'
            bp.setAttribute('data-baidu-push', '1')
            const s = document.getElementsByTagName('script')[0]
            s.parentNode?.insertBefore(bp, s)
        }
    }, [])

    return null
}
