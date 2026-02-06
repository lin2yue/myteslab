'use client'

import Script from 'next/script'

/**
 * 百度统计组件
 * 用于追踪和分析网站流量
 */
export function BaiduAnalytics() {
    const BAIDU_ID = process.env.NEXT_PUBLIC_BAIDU_ANALYTICS_ID

    if (!BAIDU_ID) return null

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
