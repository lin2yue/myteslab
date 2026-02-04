import Script from 'next/script'

export function GoogleAnalytics() {
    const GA_ID = process.env.NEXT_PUBLIC_GA_ID

    // 如果没有配置 GA ID，不渲染任何内容
    if (!GA_ID) {
        return null
    }

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
          gtag('config', '${GA_ID}', {
            page_path: window.location.pathname,
          });
        `}
            </Script>
        </>
    )
}
