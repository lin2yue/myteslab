import { getWraps, getModels } from '@/lib/api'

export async function GET() {
    const baseUrl = 'https://myteslab.com'
    const locales = ['en', 'zh']

    // 1. Static Pages
    const staticPages = ['', 'terms', 'privacy', 'refund']
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`

    // Add static pages
    for (const page of staticPages) {
        for (const locale of locales) {
            const url = `${baseUrl}/${locale}${page ? `/${page}` : ''}`
            xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page === '' ? '1.0' : '0.5'}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en${page ? `/${page}` : ''}"/>
    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}/zh${page ? `/${page}` : ''}"/>
  </url>`
        }
    }

    // 2. Model Pages
    try {
        const models = await getModels()
        for (const model of models) {
            for (const locale of locales) {
                const url = `${baseUrl}/${locale}/models/${model.slug}`
                xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/models/${model.slug}"/>
    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}/zh/models/${model.slug}"/>
  </url>`
            }
        }
    } catch (e) {
        console.error('Sitemap model generation error:', e)
    }

    // 3. Wrap Pages
    try {
        const wraps = await getWraps()
        const qualifiedWraps = wraps.filter(w => w.category === 'official' || (w.is_public && w.download_count > 0))
        for (const wrap of qualifiedWraps) {
            for (const locale of locales) {
                const url = `${baseUrl}/${locale}/wraps/${wrap.slug}`
                const date = wrap.updated_at || wrap.created_at || new Date().toISOString()
                const isoDate = new Date(date).toISOString()
                xml += `
  <url>
    <loc>${url}</loc>
    <lastmod>${isoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/wraps/${wrap.slug}"/>
    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}/zh/wraps/${wrap.slug}"/>
  </url>`
            }
        }
    } catch (e) {
        console.error('Sitemap wrap generation error:', e)
    }

    xml += `
</urlset>`

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
        },
    })
}
