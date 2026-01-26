import { getWraps, getModels } from '@/lib/api'
import { getOptimizedImageUrl } from '@/lib/images'

const baseUrl = 'https://myteslab.com'
const locales = ['en', 'zh']
const WRAPS_PER_PAGE = 5000 // Each file can hold 50k, but 5k is safer for memory/speed during generation

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'

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
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${page ? `/${page}` : ''}"/>
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
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/models/${model.slug}"/>
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
            const qualifiedWraps = wraps.filter(w =>
                w.is_active !== false && w.is_public !== false
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
                    const imageUrl = getOptimizedImageUrl(wrap.preview_url || wrap.texture_url, { width: 1200 })
                    const absoluteImgUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`
                    const modelName = wrap.model_slug?.replace(/-/g, ' ') || ''
                    const imgTitle = `${wrap.name} Tesla ${modelName} wrap design`
                    const imgCaption = `Premium ${wrap.name} wrap pattern for Tesla ${modelName}. Free high-quality vinyl wrap design template.`

                    xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${isoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/wraps/${wrap.slug}"/>
    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}/zh/wraps/${wrap.slug}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/wraps/${wrap.slug}"/>
    <image:image>
      <image:loc>${absoluteImgUrl}</image:loc>
      <image:title>${imgTitle}</image:title>
      <image:caption>${imgCaption}</image:caption>
    </image:image>
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
