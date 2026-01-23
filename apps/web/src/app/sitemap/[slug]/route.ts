import { getWraps, getModels } from '@/lib/api'

const baseUrl = 'https://myteslab.com'
const locales = ['en', 'zh']
const WRAPS_PER_PAGE = 5000 // Each file can hold 50k, but 5k is safer for memory/speed during generation

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'

    // 1. Static Pages
    if (slug === 'static.xml') {
        const staticPages = ['', 'terms', 'privacy', 'refund', 'ai-generate/generate']
        for (const page of staticPages) {
            for (const locale of locales) {
                const url = `${baseUrl}/${locale}${page ? `/${page}` : ''}`
                const priority = page === '' ? '1.0' : page === 'ai-generate/generate' ? '0.9' : '0.5'
                xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en${page ? `/${page}` : ''}"/>
    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}/zh${page ? `/${page}` : ''}"/>
  </url>\n`
            }
        }
    }

    // 2. Model Pages
    else if (slug === 'models.xml') {
        try {
            const models = await getModels()
            for (const model of models) {
                for (const locale of locales) {
                    const url = `${baseUrl}/${locale}/models/${model.slug}`
                    xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/models/${model.slug}"/>
    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}/zh/models/${model.slug}"/>
  </url>\n`
                }
            }
        } catch (e) {
            console.error('Sitemap model generation error:', e)
        }
    }

    // 3. Wrap Pages (Pagination)
    else if (slug.startsWith('wraps-') && slug.endsWith('.xml')) {
        const pageMatch = slug.match(/wraps-(\d+)\.xml/)
        if (!pageMatch) return new Response('Not Found', { status: 404 })

        const pageNumber = parseInt(pageMatch[1], 10)
        if (isNaN(pageNumber) || pageNumber < 1) return new Response('Not Found', { status: 404 })

        try {
            const wraps = await getWraps()
            // Quality Gate: Published, Noindex=false, and (Official or (Downloads > 0 and has preview))
            const qualifiedWraps = wraps.filter(w =>
                w.is_active !== false && // Assume active equals published in current schema
                (w.category === 'official' || (w.is_public && w.download_count > 0 && w.preview_url))
            )

            const start = (pageNumber - 1) * WRAPS_PER_PAGE
            const pagedWraps = qualifiedWraps.slice(start, start + WRAPS_PER_PAGE)

            if (pagedWraps.length === 0 && pageNumber > 1) {
                return new Response('Not Found', { status: 404 })
            }

            for (const wrap of pagedWraps) {
                for (const locale of locales) {
                    const url = `${baseUrl}/${locale}/wraps/${wrap.slug}`
                    const date = wrap.updated_at || wrap.created_at || new Date().toISOString()
                    const isoDate = new Date(date).toISOString()
                    xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${isoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/wraps/${wrap.slug}"/>
    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}/zh/wraps/${wrap.slug}"/>
  </url>\n`
                }
            }
        } catch (e) {
            console.error('Sitemap wrap generation error:', e)
        }
    } else {
        return new Response('Not Found', { status: 404 })
    }

    xml += '</urlset>'

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
        },
    })
}
