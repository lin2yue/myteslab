import { MetadataRoute } from 'next'
import { getWraps, getModels } from '@/lib/api'

const baseUrl = 'https://myteslab.com'
const locales = ['en', 'zh']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // 1. Static Pages
    const staticPages = ['', 'terms', 'privacy', 'refund']
    const staticEntries = staticPages.flatMap((page) =>
        locales.map((locale) => ({
            url: `${baseUrl}/${locale}${page ? `/${page}` : ''}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: page === '' ? 1.0 : 0.5,
            alternates: {
                languages: {
                    en: `${baseUrl}/en${page ? `/${page}` : ''}`,
                    zh: `${baseUrl}/zh${page ? `/${page}` : ''}`,
                },
            },
        }))
    )

    // 2. Model Pages
    const models = await getModels()
    const modelEntries = models.flatMap((model) =>
        locales.map((locale) => ({
            url: `${baseUrl}/${locale}/models/${model.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            alternates: {
                languages: {
                    en: `${baseUrl}/en/models/${model.slug}`,
                    zh: `${baseUrl}/zh/models/${model.slug}`,
                },
            },
        }))
    )

    // 3. Wrap Pages
    const wraps = await getWraps()
    const qualifiedWraps = wraps.filter(w => w.category === 'official' || (w.is_public && w.download_count > 0))
    const wrapEntries = qualifiedWraps.flatMap((wrap) =>
        locales.map((locale) => ({
            url: `${baseUrl}/${locale}/wraps/${wrap.slug}`,
            lastModified: wrap.updated_at ? new Date(wrap.updated_at) : new Date(wrap.created_at),
            changeFrequency: 'weekly' as const,
            priority: 0.6,
            alternates: {
                languages: {
                    en: `${baseUrl}/en/wraps/${wrap.slug}`,
                    zh: `${baseUrl}/zh/wraps/${wrap.slug}`,
                },
            },
        }))
    )

    return [...staticEntries, ...modelEntries, ...wrapEntries]
}
