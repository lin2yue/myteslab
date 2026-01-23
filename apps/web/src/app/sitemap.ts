import { MetadataRoute } from 'next'
import { getWraps } from '@/lib/api'

const baseUrl = 'https://myteslab.com'
const locales = ['en', 'zh']

export function generateSitemaps() {
    // 0: static, 1: models, 2: wraps
    return [{ id: 'static' }, { id: 'models' }, { id: 'wraps' }]
}

export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
    if (id === 'static') {
        const staticPages = ['', 'terms', 'privacy', 'refund']
        return staticPages.flatMap((page) =>
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
    }

    if (id === 'models') {
        const { getModels } = await import('@/lib/api')
        const models = await getModels()
        return models.flatMap((model) =>
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
    }

    if (id === 'wraps') {
        const wraps = await getWraps()
        // 质量门禁：仅索引已公开且下载量 > 0 的作品，或者是官方作品
        const qualifiedWraps = wraps.filter(w => w.category === 'official' || (w.is_public && w.download_count > 0))

        return qualifiedWraps.flatMap((wrap) =>
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
    }

    return []
}
