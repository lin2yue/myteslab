import { dbQuery } from '@/lib/db'

const baseUrl = 'https://tewan.club'
const WRAPS_PER_PAGE = 5000

type WrapRow = {
  slug: string | null
  updated_at: string | null
  created_at: string | null
}

type ModelRow = {
  slug: string
}

function toIsoDate(dateValue: string | null): string {
  const parsed = dateValue ? new Date(dateValue) : new Date()
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

export async function GET() {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  // Static pages
  const staticPages = ['', 'terms', 'privacy', 'refund', 'pricing', 'ai-generate/generate']
  for (const page of staticPages) {
    const url = `${baseUrl}${page ? `/${page}` : ''}`
    xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${new Date().toISOString()}</lastmod>\n  </url>\n`
  }

  // Model pages
  const { rows: modelRows } = await dbQuery<ModelRow>(
    `SELECT slug FROM car_models WHERE is_active = true ORDER BY sort_order ASC, slug ASC`
  )
  for (const model of modelRows) {
    const url = `${baseUrl}/models/${encodeURIComponent(model.slug)}`
    xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${new Date().toISOString()}</lastmod>\n  </url>\n`
  }

  // Wrap pages
  let page = 1
  while (true) {
    const offset = (page - 1) * WRAPS_PER_PAGE
    const { rows } = await dbQuery<WrapRow>(
      `SELECT slug, updated_at, created_at
       FROM wraps
       WHERE is_active = true
         AND is_public = true
         AND slug IS NOT NULL
       ORDER BY created_at DESC, id DESC
       LIMIT $1 OFFSET $2`,
      [WRAPS_PER_PAGE, offset]
    )

    if (!rows.length) break

    for (const wrap of rows) {
      const wrapSlug = (wrap.slug || '').trim()
      if (!wrapSlug) continue
      xml += `  <url>\n    <loc>${baseUrl}/wraps/${encodeURIComponent(wrapSlug)}</loc>\n    <lastmod>${toIsoDate(wrap.updated_at || wrap.created_at)}</lastmod>\n  </url>\n`
    }

    page += 1
  }

  xml += '</urlset>'

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
    },
  })
}
