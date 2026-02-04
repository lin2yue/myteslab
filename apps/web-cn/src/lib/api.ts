import { unstable_cache } from 'next/cache'
import type { Wrap, Model } from '@/lib/types'
import { DEFAULT_MODELS } from '@/config/models'
import { dbQuery } from '@/lib/db'

/**
 * 注入车型信息到作品对象中
 */
async function injectModelInfo(wraps: Wrap[]): Promise<Wrap[]> {
    if (!wraps || wraps.length === 0) return wraps;
    const modelSlugs = wraps.map(w => w.model_slug).filter(Boolean) as string[];
    if (modelSlugs.length === 0) return wraps;
    const models = await getModelsBySlugs(modelSlugs);
    const modelMap = new Map(models.map(m => [m.slug, m]));

    return wraps.map(w => {
        if (!w.model_slug) return w;
        const model = modelMap.get(w.model_slug);
        if (model) {
            return {
                ...w,
                model_name: model.name,
                model_name_en: model.name_en || model.name,
                // 如果作品没有自带模型URL，使用车型的默认URL
                model_3d_url: w.model_3d_url || model.model_3d_url
            };
        }
        return w;
    });
}

import { ensureCdnUrl } from '@/lib/images'

async function getModelsBySlugs(slugs: string[]): Promise<Model[]> {
    const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean))).sort();
    if (uniqueSlugs.length === 0) return [];

    return await unstable_cache(
        async () => {
            try {
                const { rows } = await dbQuery<Model>(
                    `SELECT slug, name, name_en, model_3d_url, wheel_url
                     FROM wrap_models
                     WHERE is_active = true
                     AND slug = ANY($1::text[])`,
                    [uniqueSlugs]
                )

                const models = rows || []
                if (models.length >= uniqueSlugs.length) return models

                const fallback = DEFAULT_MODELS.filter(m => uniqueSlugs.includes(m.slug)) as Model[]
                const map = new Map<string, Model>()
                models.forEach(m => map.set(m.slug, m))
                fallback.forEach(m => {
                    if (!map.has(m.slug)) map.set(m.slug, m)
                })
                return Array.from(map.values())
            } catch (dbError) {
                console.error('[getModelsBySlugs] Database query failed:', dbError)
                return DEFAULT_MODELS.filter(m => uniqueSlugs.includes(m.slug)) as Model[]
            }
        },
        ['models-by-slug-v1', ...uniqueSlugs],
        { revalidate: 3600, tags: ['models'] }
    )()
}

/**
 * 将数据库记录规范化为 Wrap 接口格式
 */
function normalizeWrap(w: any): Wrap {
    const profile = w.profiles || {
        display_name: w.profile_display_name || null,
        avatar_url: w.profile_avatar_url || null,
    };

    return {
        ...w,
        name: w.name || w.prompt || 'Untitled Wrap',
        name_en: w.name_en || w.name || w.prompt || 'Untitled Wrap',
        description: w.description || '',
        description_en: w.description_en || w.description || '',
        slug: w.slug || w.id,
        wrap_image_url: w.texture_url ? ensureCdnUrl(w.texture_url) : undefined,
        preview_image_url: w.preview_url ? ensureCdnUrl(w.preview_url) : undefined,
        image_url: w.texture_url ? ensureCdnUrl(w.texture_url) : undefined,
        model_slug: w.model_slug,
        category: w.category || 'ai_generated', // Maintain a safe fallback for display
        is_active: w.is_active ?? true,
        author_name: profile?.display_name || w.author_name || (w.category === 'official' ? '特玩' : 'Anonymous'),
        author_avatar_url: profile?.avatar_url,
        author_username: profile?.display_name,
        download_count: w.download_count || 0,
        created_at: w.created_at || new Date().toISOString(),
        reference_images: Array.isArray(w.reference_images)
            ? w.reference_images.map((img: any) => typeof img === 'string' ? ensureCdnUrl(img) : null).filter(Boolean)
            : []
    } as Wrap
}

export async function getWraps(
    modelSlug?: string,
    page: number = 1,
    pageSize: number = 12,
    sortBy: 'latest' | 'popular' = 'latest'
): Promise<Wrap[]> {
    try {
        return await unstable_cache(
            () => fetchWrapsInternal(modelSlug, page, pageSize, sortBy),
            ['wraps-v7', modelSlug || 'all', String(page), sortBy],
            { revalidate: 60, tags: ['wraps'] }
        )()
    } catch (error) {
        console.error('获取贴图列表异常:', error)
        return []
    }
}

async function fetchWrapsInternal(
    modelSlug: string | undefined,
    page: number,
    pageSize: number,
    sortBy: 'latest' | 'popular'
): Promise<Wrap[]> {
    const from = (page - 1) * pageSize

    try {
        // 列表页排除巨大的 texture_url / reference_images 以符合 Next.js 2MB 缓存限制
        const params: any[] = []
        let where = 'w.is_public = true AND w.is_active = true'
        if (modelSlug) {
            params.push(modelSlug)
            where += ` AND w.model_slug = $${params.length}`
        }
        const orderBy = sortBy === 'popular' ? 'w.download_count DESC' : 'w.created_at DESC'
        params.push(pageSize)
        const limitParam = `$${params.length}`
        params.push(from)
        const offsetParam = `$${params.length}`

        const sql = `
            SELECT
                w.id,
                w.slug,
                w.name,
                w.name_en,
                w.prompt,
                w.category,
                w.preview_url,
                w.model_slug,
                w.user_id,
                w.download_count,
                w.is_public,
                w.is_active,
                w.created_at,
                p.display_name AS profile_display_name,
                p.avatar_url AS profile_avatar_url
            FROM wraps w
            LEFT JOIN profiles p ON p.id = w.user_id
            WHERE ${where}
            ORDER BY ${orderBy}
            LIMIT ${limitParam}
            OFFSET ${offsetParam}
        `

        const { rows } = await dbQuery(sql, params)
        const normalized = (rows || []).map(w => normalizeWrap(w))
        // 注入车型名称
        const withModelInfo = await injectModelInfo(normalized)

        // 移除过多的调试日志输出，仅记录关键信息
        const totalSize = Buffer.byteLength(JSON.stringify(withModelInfo))
        if (totalSize > 1024 * 1024) {
            console.warn(`[WARN] fetchWrapsInternal result is still large: ${totalSize} bytes`)
        }
        return withModelInfo

    } catch (err) {
        console.error('fetchWrapsInternal error:', err)
        return []
    }
}

export async function getWrap(slugOrId: string): Promise<Wrap | null> {
    try {
        // 判断是否为 UUID 格式 (8-4-4-4-12)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

        const selectSql = `
            SELECT
                w.id,
                w.slug,
                w.name,
                w.name_en,
                w.description,
                w.description_en,
                w.prompt,
                w.texture_url,
                w.preview_url,
                w.model_slug,
                w.category,
                w.is_active,
                w.is_public,
                w.user_id,
                w.download_count,
                w.created_at,
                w.reference_images,
                w.tags,
                w.source,
                w.attribution,
                w.author_name,
                w.author_id,
                w.thumb_url,
                w.thumbnail_url,
                w.deleted_at,
                p.display_name AS profile_display_name,
                p.avatar_url AS profile_avatar_url
            FROM wraps w
            LEFT JOIN profiles p ON p.id = w.user_id
            WHERE %CONDITION%
            LIMIT 1
        `

        const queryBy = async (condition: string, value: string) => {
            const sql = selectSql.replace('%CONDITION%', condition)
            const { rows } = await dbQuery(sql, [value])
            return rows[0] || null
        }

        let wrapRecord = isUuid
            ? await queryBy('w.id = $1', slugOrId)
            : await queryBy('w.slug = $1', slugOrId)

        if (!wrapRecord && !isUuid) {
            wrapRecord = await queryBy('w.id = $1', slugOrId)
        }

        if (!wrapRecord) return null

        const normalized = normalizeWrap(wrapRecord)
        const withModelInfo = await injectModelInfo([normalized])
        return withModelInfo[0]
    } catch (error) {
        console.error('获取贴图详情异常:', error)
        return null
    }
}

export async function getModels(): Promise<Model[]> {
    try {
        return await unstable_cache(
            async () => {
                try {
                    const { rows } = await dbQuery<Model>(
                        `SELECT *
                         FROM wrap_models
                         WHERE is_active = true
                         ORDER BY sort_order ASC`
                    )

                    const models = rows || []

                    if (models.length === 0) {
                        console.warn('[getModels] Empty result, falling back to default models');
                        return DEFAULT_MODELS.filter(m => m.is_active) as Model[];
                    }

                    return models as Model[]
                } catch (dbError) {
                    console.error('[getModels] Database query failed:', dbError)
                    return DEFAULT_MODELS.filter(m => m.is_active) as Model[];
                }
            },
            ['models-v9'], // Incremented version to force cache refresh
            { revalidate: 3600, tags: ['models'] }
        )()
    } catch (error) {
        console.error('[getModels] Fatal error:', error)
        return DEFAULT_MODELS.filter(m => m.is_active) as Model[];
    }
}

export async function incrementDownloadCount(wrapId: string): Promise<void> {
    try {
        await dbQuery(
            'UPDATE wraps SET download_count = COALESCE(download_count, 0) + 1 WHERE id = $1',
            [wrapId]
        )
    } catch (error) {
        console.error('[incrementDownloadCount] RPC failed:', error)
    }
}
