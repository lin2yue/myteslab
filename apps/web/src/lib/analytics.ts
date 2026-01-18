// Google Analytics 事件追踪工具函数

declare global {
    interface Window {
        gtag?: (
            command: string,
            targetId: string,
            config?: Record<string, any>
        ) => void
    }
}

/**
 * 追踪页面浏览
 */
export const trackPageView = (url: string) => {
    if (typeof window.gtag !== 'undefined') {
        window.gtag('config', process.env.NEXT_PUBLIC_GA_ID || '', {
            page_path: url,
        })
    }
}

/**
 * 追踪自定义事件
 */
export const trackEvent = (
    eventName: string,
    eventParams?: Record<string, any>
) => {
    if (typeof window.gtag !== 'undefined') {
        window.gtag('event', eventName, eventParams)
    }
}

/**
 * 追踪下载事件
 */
export const trackDownload = (wrapId: string, wrapName: string, wrapSlug: string) => {
    trackEvent('download_wrap', {
        wrap_id: wrapId,
        wrap_name: wrapName,
        wrap_slug: wrapSlug,
        event_category: 'engagement',
        event_label: wrapSlug,
    })
}

/**
 * 追踪 wrap 查看事件
 */
export const trackWrapView = (wrapId: string, wrapName: string, wrapSlug: string) => {
    trackEvent('view_wrap', {
        wrap_id: wrapId,
        wrap_name: wrapName,
        wrap_slug: wrapSlug,
        event_category: 'engagement',
        event_label: wrapSlug,
    })
}

/**
 * 追踪语言切换事件
 */
export const trackLanguageChange = (fromLang: string, toLang: string) => {
    trackEvent('language_change', {
        from_language: fromLang,
        to_language: toLang,
        event_category: 'engagement',
    })
}

/**
 * 追踪车型筛选事件
 */
export const trackModelFilter = (modelSlug: string, modelName: string) => {
    trackEvent('filter_model', {
        model_slug: modelSlug,
        model_name: modelName,
        event_category: 'engagement',
    })
}
