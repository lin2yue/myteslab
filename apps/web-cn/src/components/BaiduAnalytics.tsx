'use client'

import Script from 'next/script'

/**
 * 百度统计组件
 * 用于追踪和分析网站流量
 */
export function BaiduAnalytics() {
  // 使用 NEXT_PUBLIC_ 前缀的环境变量,客户端可访问
  // 注意:这个值在构建时被注入,不是运行时读取
  const BAIDU_ID = process.env.NEXT_PUBLIC_BAIDU_ANALYTICS_ID

  // 如果没有配置 ID,不渲染
  const isPlaceholderValue = BAIDU_ID === 'NEXT_PUBLIC_BAIDU_ANALYTICS_ID'
  if (!BAIDU_ID || isPlaceholderValue) {
    console.warn('[Baidu Analytics] NEXT_PUBLIC_BAIDU_ANALYTICS_ID is missing or invalid')
    return null
  }

  return (
    <Script id="baidu-analytics" strategy="afterInteractive">
      {`
        var _hmt = _hmt || [];
        (function() {
          var hm = document.createElement("script");
          hm.src = "https://hm.baidu.com/hm.js?${BAIDU_ID}";
          var s = document.getElementsByTagName("script")[0]; 
          s.parentNode.insertBefore(hm, s);
        })();
      `}
    </Script>
  )
}
