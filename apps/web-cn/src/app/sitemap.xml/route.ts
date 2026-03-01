import { dbQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

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

type ExistsRow = {
  exists: boolean
}

type ColumnRow = {
  column_name: string
}

const MODEL_TABLE_CANDIDATES = ['wrap_models', 'car_models', 'models'] as const

function toIsoDate(dateValue: string | null): string {
  const parsed = dateValue ? new Date(dateValue) : new Date()
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

async function fetchActiveModelRows(): Promise<ModelRow[]> {
  for (const tableName of MODEL_TABLE_CANDIDATES) {
    const { rows: existsRows } = await dbQuery<ExistsRow>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = $1
       ) AS exists`,
      [tableName]
    )
    if (!existsRows[0]?.exists) continue

    const { rows: columnRows } = await dbQuery<ColumnRow>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1`,
      [tableName]
    )
    const columnSet = new Set(columnRows.map(column => column.column_name))
    if (!columnSet.has('slug')) continue

    const hasIsActive = columnSet.has('is_active')
    const hasSortOrder = columnSet.has('sort_order')
    const whereClause = hasIsActive ? 'WHERE is_active = true' : ''
    const orderClause = hasSortOrder ? 'ORDER BY sort_order ASC, slug ASC' : 'ORDER BY slug ASC'

    const { rows: modelRows } = await dbQuery<ModelRow>(
      `SELECT slug FROM ${tableName} ${whereClause} ${orderClause}`
    )
    return modelRows
  }

  return []
}

export async function GET() {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  // Static pages
  const staticLastmod = '2026-02-01T00:00:00.000Z'
  const staticPages = ['', 'terms', 'privacy', 'refund', 'pricing', 'ai-generate/generate']
  for (const page of staticPages) {
    const url = `${baseUrl}${page ? `/${page}` : ''}`
    xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${staticLastmod}</lastmod>\n  </url>\n`
  }

  // Build-time / CI 可能没有数据库连接，避免直接失败
  const hasDatabase = !!process.env.DATABASE_URL

  if (hasDatabase) {
    // Model pages
    try {
      const modelRows = await fetchActiveModelRows()
      for (const model of modelRows) {
        const url = `${baseUrl}/models/${encodeURIComponent(model.slug)}`
        xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${staticLastmod}</lastmod>\n  </url>\n`
      }
    } catch (error) {
      console.error('[sitemap.xml] model query failed, skip model urls:', error)
    }

    // Wrap pages
    try {
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
    } catch (error) {
      console.error('[sitemap.xml] wrap query failed, skip wrap urls:', error)
    }
  } else {
    console.warn('[sitemap.xml] DATABASE_URL missing, emit static-only sitemap')
  }

  xml += '</urlset>'

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
    },
  })
}
