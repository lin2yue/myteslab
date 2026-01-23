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

    // 静态页面
    const staticPages = ['terms', 'privacy', 'refund']
    const otherPages: MetadataRoute.Sitemap = staticPages.flatMap((page) =>
        locales.map((locale) => ({
            url: `${baseUrl}/${locale}/${page}`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.5,
            alternates: {
                languages: {
                    en: `${baseUrl}/en/${page}`,
                    zh: `${baseUrl}/zh/${page}`,
                },
            },
        }))
    )

    // 模型聚合页（所有语言版本）
    const { getModels } = await import('@/lib/api')
    const models = await getModels()
    const modelPages: MetadataRoute.Sitemap = models.flatMap((model) =>
        locales.map((locale) => ({
            url: `${baseUrl}/${locale}/models/${model.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.9,
            alternates: {
                languages: {
                    en: `${baseUrl}/en/models/${model.slug}`,
                    zh: `${baseUrl}/zh/models/${model.slug}`,
                },
            },
        }))
    )

    return [...homePages, ...wrapPages, ...modelPages, ...otherPages]
}
