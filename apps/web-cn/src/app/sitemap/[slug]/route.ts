import { getWraps, getModels } from '@/lib/api'
import { getOptimizedImageUrl } from '@/lib/images'
import { getModelDisplayName } from '@/lib/model-display'

const baseUrl = 'https://tewan.club'
const locales = ['zh']
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

        // 为首页获取热门贴图用于图片 SEO
        let homePageWraps: any[] = []
        try {
            const wraps = await getWraps()
            homePageWraps = wraps
                .filter(w => w.is_active !== false && w.is_public !== false)
                .slice(0, 12) // 首页默认显示前 12 个
        } catch (e) {
            console.error('Failed to fetch wraps for homepage image sitemap:', e)
        }

        for (const page of staticPages) {
            for (const locale of locales) {
                const url = `${baseUrl}/${locale}${page ? `/${page}` : ''}`
                const priority = page === '' ? '1.0' : page === 'ai-generate/generate' ? '0.9' : '0.5'

                xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${baseUrl}/zh${page ? `/${page}` : ''}"/>`

                // 为首页添加图片信息
                if (page === '' && homePageWraps.length > 0) {
                    for (const wrap of homePageWraps) {
                        const imageUrl = getOptimizedImageUrl(wrap.preview_url || wrap.texture_url, { width: 1200 })
                        const absoluteImgUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`
                        const modelName = getModelDisplayName({
                            slug: wrap.model_slug,
                            modelName: wrap.model_name,
                            modelNameEn: wrap.model_name_en,
                            locale
                        })

                        const imgTitle = locale === 'en'
                            ? `${wrap.name} - Tesla ${modelName} wrap design`
                            : `${wrap.name} - 特斯拉 ${modelName} 贴膜设计`

                        const imgCaption = locale === 'en'
                            ? `Premium ${wrap.name} vinyl wrap for Tesla ${modelName}. Free download available.`
                            : `适用于特斯拉 ${modelName} 的 ${wrap.name} 车身贴膜设计，免费下载。`

                        xml += `
    <image:image>
      <image:loc>${absoluteImgUrl}</image:loc>
      <image:title>${imgTitle}</image:title>
      <image:caption>${imgCaption}</image:caption>
    </image:image>`
                    }
                }

                xml += `
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
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${baseUrl}/zh/models/${model.slug}"/>
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
                    const modelName = getModelDisplayName({
                        slug: wrap.model_slug,
                        modelName: wrap.model_name,
                        modelNameEn: wrap.model_name_en,
                        locale
                    })

                    // 动态增强图片 SEO 描述
                    const imgTitle = locale === 'en'
                        ? `${wrap.name} - Tesla ${modelName} wrap design preview`
                        : `${wrap.name} - 特斯拉 ${modelName} 贴膜预览`

                    const imgCaption = locale === 'en'
                        ? `Premium ${wrap.name} vinyl wrap pattern for Tesla ${modelName}. High-quality custom skin design template with 3D visualization. Free download available.`
                        : `适用于特斯拉 ${modelName} 的高端 ${wrap.name} 车身贴膜设计图。专业级定制纹理模板，支持 3D 可视化预览，提供免费高清下载。`

                    xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${isoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${baseUrl}/zh/wraps/${wrap.slug}"/>
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
