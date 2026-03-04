'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense, useMemo, useRef } from 'react'


/**
 * 百度统计组件
 * 注意：不禁用 _setAutoPageview，让首次加载自动上报来源（含搜索引擎 referrer）
 * SPA 路由变化时手动 _trackPageview 补报
 */
export function BaiduAnalytics() {
  const BAIDU_ID = process.env.NEXT_PUBLIC_BAIDU_ANALYTICS_ID

  const isPlaceholderValue = BAIDU_ID === 'NEXT_PUBLIC_BAIDU_ANALYTICS_ID'
  if (!BAIDU_ID || isPlaceholderValue) {
    console.warn('[Baidu Analytics] NEXT_PUBLIC_BAIDU_ANALYTICS_ID is missing or invalid')
    return null
  }

  // 非生产环境不加载,避免本地开发数据污染百度统计
  if (process.env.NODE_ENV !== 'production') {
    return null
  }

  return (
    <>
      <Script id="baidu-analytics" strategy="afterInteractive">
        {`
          window._hmt = window._hmt || [];
          (function() {
            var hm = document.createElement("script");
            hm.async = true;
            hm.src = "https://hm.baidu.com/hm.js?${BAIDU_ID}";
            var s = document.getElementsByTagName("script")[0]; 
            s.parentNode.insertBefore(hm, s);
          })();
        `}
      </Script>
      <Suspense fallback={null}>
        <TrackPageview />
      </Suspense>
    </>
  )
}

function TrackPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstRender = useRef(true)
  const lastTrackedUrlRef = useRef<string>('')

  const url = useMemo(() => {
    const query = searchParams.toString()
    return `${pathname}${query ? `?${query}` : ''}`
  }, [pathname, searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    // 首次加载跳过手动上报，让百度 SDK 自动处理（保留 referrer / 搜索来源）
    if (isFirstRender.current) {
      isFirstRender.current = false
      lastTrackedUrlRef.current = url
      return
    }
    // SPA 路由变化时手动补报
    if (lastTrackedUrlRef.current === url) return
    window._hmt = window._hmt || []
    window._hmt.push(['_trackPageview', url])
    lastTrackedUrlRef.current = url
  }, [url])

  return null
}
