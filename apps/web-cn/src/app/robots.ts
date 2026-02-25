import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://tewan.club'

    return {
        rules: [
            // Google 爬虫
            {
                userAgent: 'Googlebot',
                allow: '/',
                disallow: [
                    '/api/',
                    '/private/',
                    '/profile/',
                    '/login/',
                    '/auth/',
                    '/debug/',
                    '/admin/',
                ],
            },
            // 百度爬虫 - 国内最大搜索引擎
            {
                userAgent: 'Baiduspider',
                allow: '/',
                disallow: [
                    '/api/',
                    '/private/',
                    '/profile/',
                    '/login/',
                    '/auth/',
                    '/debug/',
                    '/admin/',
                ],
                crawlDelay: 1, // 百度爬虫建议设置延迟,避免过度抓取
            },
            // 360 搜索爬虫
            {
                userAgent: '360Spider',
                allow: '/',
                disallow: [
                    '/api/',
                    '/private/',
                    '/profile/',
                    '/login/',
                    '/auth/',
                    '/debug/',
                    '/admin/',
                ],
            },
            // 搜狗爬虫
            {
                userAgent: 'Sogou web spider',
                allow: '/',
                disallow: [
                    '/api/',
                    '/private/',
                    '/profile/',
                    '/login/',
                    '/auth/',
                    '/debug/',
                    '/admin/',
                ],
            },
            // 神马搜索爬虫(移动端)
            {
                userAgent: 'YisouSpider',
                allow: '/',
                disallow: [
                    '/api/',
                    '/private/',
                    '/profile/',
                    '/login/',
                    '/auth/',
                    '/debug/',
                    '/admin/',
                ],
            },
            // 其他爬虫
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',
                    '/private/',
                    '/profile/',
                    '/login/',
                    '/auth/',
                    '/debug/',
                    '/admin/',
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
