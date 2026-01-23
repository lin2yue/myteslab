import { getWraps } from '@/lib/api'

const baseUrl = 'https://myteslab.com'
const WRAPS_PER_PAGE = 5000

export async function GET() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    // 1. Static Sitemap
    xml += `  <sitemap>
    <loc>${baseUrl}/sitemap/static.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>\n`

    // 2. Models Sitemap
    xml += `  <sitemap>
    <loc>${baseUrl}/sitemap/models.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>\n`

    // 3. Wraps Sitemaps (Paginated)
    try {
        const wraps = await getWraps()
        // Quality Gate matching the sub-sitemap logic
        const qualifiedWraps = wraps.filter(w =>
            w.is_active !== false &&
            (w.category === 'official' || (w.is_public && w.download_count > 0 && w.preview_url))
        )

        const totalPages = Math.ceil(qualifiedWraps.length / WRAPS_PER_PAGE) || 1

        for (let i = 1; i <= totalPages; i++) {
            xml += `  <sitemap>
    <loc>${baseUrl}/sitemap/wraps-${i}.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>\n`
        }
    } catch (e) {
        console.error('Sitemap index generation error:', e)
        // Fallback to at least wraps-1.xml
        xml += `  <sitemap>
    <loc>${baseUrl}/sitemap/wraps-1.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>\n`
    }

    xml += '</sitemapindex>'

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
        },
    })
}
