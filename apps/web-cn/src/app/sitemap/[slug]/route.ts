import { getModels } from '@/lib/api';
import { dbQuery } from '@/lib/db';
import { getOptimizedImageUrl } from '@/lib/images';
import { getModelDisplayName } from '@/lib/model-display';

const baseUrl = 'https://tewan.club';
const WRAPS_PER_PAGE = 5000; // 远低于 sitemap 单文件 50k 限制，保证生成稳定

type SitemapWrapRow = {
    slug: string | null;
    name: string | null;
    model_slug: string | null;
    preview_url: string | null;
    texture_url: string | null;
    created_at: string | null;
    updated_at: string | null;
};

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function toAbsoluteImageUrl(imageUrl: string): string {
    return imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;
}

function toIsoDate(dateValue: string | null): string {
    const parsed = dateValue ? new Date(dateValue) : new Date();
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
}

async function fetchHomepageWraps(limit: number): Promise<SitemapWrapRow[]> {
    const { rows } = await dbQuery<SitemapWrapRow>(
        `SELECT slug, name, model_slug, preview_url, texture_url, created_at, updated_at
         FROM wraps
         WHERE is_active = true
           AND is_public = true
           AND slug IS NOT NULL
         ORDER BY COALESCE(user_download_count, download_count, 0) DESC, created_at DESC, id DESC
         LIMIT $1`,
        [limit]
    );
    return rows || [];
}

async function fetchPagedWraps(pageNumber: number): Promise<SitemapWrapRow[]> {
    const offset = (pageNumber - 1) * WRAPS_PER_PAGE;
    const { rows } = await dbQuery<SitemapWrapRow>(
        `SELECT slug, name, model_slug, preview_url, texture_url, created_at, updated_at
         FROM wraps
         WHERE is_active = true
           AND is_public = true
           AND slug IS NOT NULL
         ORDER BY created_at DESC, id DESC
         LIMIT $1 OFFSET $2`,
        [WRAPS_PER_PAGE, offset]
    );
    return rows || [];
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    // 1. Static Pages
    if (slug === 'static.xml') {
        const staticPages = ['', 'terms', 'privacy', 'refund', 'ai-generate/generate'];
        const models = await getModels();

        let homePageWraps: SitemapWrapRow[] = [];
        try {
            homePageWraps = await fetchHomepageWraps(12);
        } catch (error) {
            console.error('Failed to fetch wraps for homepage image sitemap:', error);
        }

        for (const page of staticPages) {
            const url = `${baseUrl}${page ? `/${page}` : ''}`;
            const priority = page === '' ? '1.0' : page === 'ai-generate/generate' ? '0.9' : '0.5';

            xml += `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>`;

            // 为首页补充热门作品图片 SEO
            if (page === '' && homePageWraps.length > 0) {
                for (const wrap of homePageWraps) {
                    const textureLikeUrl = wrap.preview_url || wrap.texture_url;
                    const wrapName = (wrap.name || 'Tesla Wrap').trim();
                    if (!textureLikeUrl || !wrapName) continue;

                    const imageUrl = getOptimizedImageUrl(textureLikeUrl, { width: 1200 });
                    const absoluteImgUrl = toAbsoluteImageUrl(imageUrl);
                    const modelName = getModelDisplayName({
                        slug: wrap.model_slug || undefined,
                        models,
                        locale: 'zh'
                    });

                    const imgTitle = `${wrapName} - 特斯拉 ${modelName} 贴膜设计`;
                    const imgCaption = `适用于特斯拉 ${modelName} 的 ${wrapName} 车身贴膜设计，免费下载。`;

                    xml += `
    <image:image>
      <image:loc>${escapeXml(absoluteImgUrl)}</image:loc>
      <image:title>${escapeXml(imgTitle)}</image:title>
      <image:caption>${escapeXml(imgCaption)}</image:caption>
    </image:image>`;
                }
            }

            xml += `
  </url>\n`;
        }
    }

    // 2. Model Pages
    else if (slug === 'models.xml') {
        try {
            const models = await getModels();
            for (const model of models) {
                const url = `${baseUrl}/models/${encodeURIComponent(model.slug)}`;
                xml += `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
            }
        } catch (error) {
            console.error('Sitemap model generation error:', error);
        }
    }

    // 3. Wrap Pages (Pagination)
    else if (slug.startsWith('wraps-') && slug.endsWith('.xml')) {
        const pageMatch = slug.match(/wraps-(\d+)\.xml/);
        if (!pageMatch) return new Response('Not Found', { status: 404 });

        const pageNumber = parseInt(pageMatch[1], 10);
        if (Number.isNaN(pageNumber) || pageNumber < 1) {
            return new Response('Not Found', { status: 404 });
        }

        try {
            const models = await getModels();
            const pagedWraps = await fetchPagedWraps(pageNumber);

            if (pagedWraps.length === 0 && pageNumber > 1) {
                return new Response('Not Found', { status: 404 });
            }

            for (const wrap of pagedWraps) {
                const wrapSlug = (wrap.slug || '').trim();
                const wrapName = (wrap.name || '').trim();
                const textureLikeUrl = wrap.preview_url || wrap.texture_url;
                if (!wrapSlug || !wrapName || !textureLikeUrl) continue;

                const url = `${baseUrl}/wraps/${encodeURIComponent(wrapSlug)}`;
                const isoDate = toIsoDate(wrap.updated_at || wrap.created_at);
                const imageUrl = getOptimizedImageUrl(textureLikeUrl, { width: 1200 });
                const absoluteImgUrl = toAbsoluteImageUrl(imageUrl);
                const modelName = getModelDisplayName({
                    slug: wrap.model_slug || undefined,
                    models,
                    locale: 'zh'
                });

                const imgTitle = `${wrapName} - 特斯拉 ${modelName} 贴膜预览`;
                const imgCaption = `适用于特斯拉 ${modelName} 的高端 ${wrapName} 车身贴膜设计图。专业级定制纹理模板，支持 3D 可视化预览，提供免费高清下载。`;

                xml += `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${isoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
    <image:image>
      <image:loc>${escapeXml(absoluteImgUrl)}</image:loc>
      <image:title>${escapeXml(imgTitle)}</image:title>
      <image:caption>${escapeXml(imgCaption)}</image:caption>
    </image:image>
  </url>\n`;
            }
        } catch (error) {
            console.error('Sitemap wrap generation error:', error);
        }
    } else {
        return new Response('Not Found', { status: 404 });
    }

    xml += '</urlset>';

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
        },
    });
}
