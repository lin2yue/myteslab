'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense, useMemo, useRef } from 'react'

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-7GB58HSM8G'

export function GoogleAnalytics() {
  if (!GA_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: true });
        `}
      </Script>
      <Suspense fallback={null}>
        <GATrackPageview />
      </Suspense>
    </>
  )
}

function GATrackPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstRender = useRef(true)
  const lastTrackedUrlRef = useRef<string>('')

  const url = useMemo(() => {
    const query = searchParams.toString()
    return `${pathname}${query ? `?${query}` : ''}`
  }, [pathname, searchParams])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.gtag) return
    // 首次让 GA SDK 自动上报，保留来源信息
    if (isFirstRender.current) {
      isFirstRender.current = false
      lastTrackedUrlRef.current = url
      return
    }
    if (lastTrackedUrlRef.current === url) return
    window.gtag('event', 'page_view', {
      page_location: window.location.href,
      page_path: url,
    })
    lastTrackedUrlRef.current = url
  }, [url])

  return null
}
