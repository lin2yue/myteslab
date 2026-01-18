import { MetadataRoute } from 'next'
import { getWraps } from '@/lib/api'

const baseUrl = 'https://myteslab.com'
const locales = ['en', 'zh']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const wraps = await getWraps()

    // 首页（所有语言版本）
    const homePages: MetadataRoute.Sitemap = locales.map((locale) => ({
        url: `${baseUrl}/${locale}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
        alternates: {
            languages: {
                en: `${baseUrl}/en`,
                zh: `${baseUrl}/zh`,
            },
        },
    }))

    // Wraps 详情页（所有语言版本）
    const wrapPages: MetadataRoute.Sitemap = wraps.flatMap((wrap) =>
        locales.map((locale) => ({
            url: `${baseUrl}/${locale}/wraps/${wrap.slug}`,
            lastModified: wrap.updated_at ? new Date(wrap.updated_at) : new Date(wrap.created_at),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            alternates: {
                languages: {
                    en: `${baseUrl}/en/wraps/${wrap.slug}`,
                    zh: `${baseUrl}/zh/wraps/${wrap.slug}`,
                },
            },
        }))
    )

    return [...homePages, ...wrapPages]
}
