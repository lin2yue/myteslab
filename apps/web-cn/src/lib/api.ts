import { unstable_cache } from 'next/cache'
import type { Wrap, Model } from '@/lib/types'
import { DEFAULT_MODELS } from '@/config/models'
import { dbQuery } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'

export type WrapSortBy = 'recommended' | 'popular' | 'latest'
const RECOMMENDED_POPULAR_WEIGHT = 0.55
const RECOMMENDED_FRESH_WEIGHT = 0.45
const RECOMMENDED_FRESH_DECAY_HOURS = 168
const RECOMMENDED_HEAD_FRESH_HOURS = 72
const RECOMMENDED_HEAD_MIN_HEAT = 0
const RECOMMENDED_HEAD_MAX_HEAT = 12

/**
 * 注入车型信息到作品对象中
 */
async function injectModelInfo(wraps: Wrap[]): Promise<Wrap[]> {
    if (!wraps || wraps.length === 0) return wraps;
    const modelSlugs = wraps.map(w => w.model_slug).filter(Boolean) as string[];
    if (modelSlugs.length === 0) return wraps;
    const models = await getModelsBySlugs(modelSlugs);
    const modelMap = new Map<string, Model>(models.map((m: Model) => [m.slug, m]));

    return wraps.map((w: Wrap) => {
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
                models.forEach((m: Model) => map.set(m.slug, m))
                fallback.forEach((m: Model) => {
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
        role: w.profile_role || null,
    };
    const normalizedTextureUrl = ensureCdnUrl(w.texture_url || w.preview_url || '');
    const normalizedPreviewUrl = ensureCdnUrl(w.preview_url || w.texture_url || '');

    return {
        ...w,
        texture_url: normalizedTextureUrl,
        preview_url: normalizedPreviewUrl,
        name: w.name || w.prompt || 'Untitled Wrap',
        name_en: w.name_en || w.name || w.prompt || 'Untitled Wrap',
        description: w.description || '',
        description_en: w.description_en || w.description || '',
        slug: w.slug || w.id,
        wrap_image_url: normalizedTextureUrl || undefined,
        preview_image_url: normalizedPreviewUrl || undefined,
        image_url: normalizedTextureUrl || undefined,
        model_slug: w.model_slug,
        category: w.category || 'ai_generated', // Maintain a safe fallback for display
        is_active: w.is_active ?? true,
        author_name: profile?.display_name || w.author_name || (w.category === 'official' ? '特玩' : 'Anonymous'),
        author_avatar_url: profile?.avatar_url,
        author_username: profile?.display_name,
        author_role: profile?.role || w.author_role || null,
        download_count: w.download_count || 0,
        user_download_count: w.user_download_count ?? w.download_count ?? 0,
        created_at: w.created_at || new Date().toISOString(),
        reference_images: Array.isArray(w.reference_images)
            ? w.reference_images.map((img: any) => typeof img === 'string' ? ensureCdnUrl(img) : null).filter(Boolean)
            : []
    } as Wrap
}

function normalizeSearchQuery(searchQuery?: string): string {
    return (searchQuery || '').trim().replace(/\s+/g, ' ')
}

interface WrapKeywordRow {
    name: string | null
    name_en: string | null
}

export async function getWrapKeywordSuggestions(
    modelSlug?: string,
    locale: 'zh' | 'en' = 'zh',
    limit: number = 8
): Promise<string[]> {
    try {
        return await unstable_cache(
            () => fetchWrapKeywordSuggestionsInternal(modelSlug, locale, limit),
            ['wrap-keywords-v1', modelSlug || 'all', locale, String(limit)],
            { revalidate: 300, tags: ['wraps'] }
        )()
    } catch (error) {
        console.error('获取推荐关键词异常:', error)
        return []
    }
}

async function fetchWrapKeywordSuggestionsInternal(
    modelSlug: string | undefined,
    locale: 'zh' | 'en',
    limit: number
): Promise<string[]> {
    try {
        const params: unknown[] = []
        let where = `w.is_public = true AND w.is_active = true`
        if (modelSlug) {
            params.push(modelSlug)
            where += ` AND w.model_slug = $${params.length}`
        }
        params.push(Math.max(limit * 4, 24))
        const sql = `
            SELECT w.name, w.name_en
            FROM wraps w
            WHERE ${where}
            ORDER BY COALESCE(w.user_download_count, w.download_count, 0) DESC, w.created_at DESC
            LIMIT $${params.length}
        `
        const { rows } = await dbQuery<WrapKeywordRow>(sql, params)
        const seen = new Set<string>()
        const keywords: string[] = []

        for (const row of rows || []) {
            const text = (locale === 'en' ? (row.name_en || row.name || '') : (row.name || row.name_en || '')).trim()
            if (!text) continue
            if (seen.has(text)) continue
            seen.add(text)
            keywords.push(text)
            if (keywords.length >= limit) break
        }

        return keywords
    } catch (err) {
        console.error('fetchWrapKeywordSuggestionsInternal error:', err)
        return []
    }
}

export async function getWraps(
    modelSlug?: string,
    page: number = 1,
    pageSize: number = 12,
    sortBy: WrapSortBy = 'latest',
    searchQuery?: string
): Promise<Wrap[]> {
    const normalizedSearchQuery = normalizeSearchQuery(searchQuery)

    try {
        if (normalizedSearchQuery) {
            return await fetchWrapsInternal(modelSlug, page, pageSize, sortBy, normalizedSearchQuery)
        }

        return await unstable_cache(
            () => fetchWrapsInternal(modelSlug, page, pageSize, sortBy, normalizedSearchQuery),
            ['wraps-v12', modelSlug || 'all', String(page), sortBy, normalizedSearchQuery || 'none'],
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
    sortBy: WrapSortBy,
    searchQuery: string = ''
): Promise<Wrap[]> {
    const from = (page - 1) * pageSize

    try {
        // 列表页排除 reference_images 以控制缓存体积
        const params: any[] = []
        let where = 'w.is_public = true AND w.is_active = true'
        if (modelSlug) {
            params.push(modelSlug)
            where += ` AND w.model_slug = $${params.length}`
        }
        if (searchQuery) {
            params.push(`%${searchQuery}%`)
            const searchParam = `$${params.length}`
            where += ` AND (w.name ILIKE ${searchParam} OR COALESCE(w.name_en, '') ILIKE ${searchParam} OR COALESCE(w.prompt, '') ILIKE ${searchParam})`
        }
        const publishedAgeHoursExpr = `
            GREATEST(EXTRACT(EPOCH FROM (NOW() - COALESCE(w.first_published_at, w.created_at))) / 3600.0, 0)
        `
        const recommendedHeadCondition = `
            ${publishedAgeHoursExpr} <= ${RECOMMENDED_HEAD_FRESH_HOURS}
            AND COALESCE(w.user_download_count, w.download_count, 0) BETWEEN ${RECOMMENDED_HEAD_MIN_HEAT} AND ${RECOMMENDED_HEAD_MAX_HEAT}
        `
        const orderBy = sortBy === 'recommended'
            ? `
                CASE
                    WHEN ${recommendedHeadCondition}
                    THEN 1 ELSE 0
                END DESC,
                CASE
                    WHEN ${recommendedHeadCondition}
                    THEN COALESCE(w.first_published_at, w.created_at) ELSE NULL
                END DESC,
                (
                    ${RECOMMENDED_POPULAR_WEIGHT} * LN(1 + COALESCE(w.user_download_count, w.download_count, 0))
                    + ${RECOMMENDED_FRESH_WEIGHT} * EXP(
                        -${publishedAgeHoursExpr} / ${RECOMMENDED_FRESH_DECAY_HOURS}
                    )
                ) DESC,
                COALESCE(w.user_download_count, w.download_count, 0) DESC,
                COALESCE(w.first_published_at, w.created_at) DESC,
                w.id DESC
            `
            : sortBy === 'popular'
                ? 'COALESCE(w.user_download_count, w.download_count, 0) DESC, w.id DESC'
                : 'COALESCE(w.first_published_at, w.created_at) DESC, w.id DESC'
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
                w.texture_url,
                w.preview_url,
                w.model_slug,
                w.user_id,
                w.download_count,
                w.user_download_count,
                w.price_credits,
                w.is_public,
                w.is_active,
                w.created_at,
                p.display_name AS profile_display_name,
                p.avatar_url AS profile_avatar_url,
                p.role AS profile_role
            FROM wraps w
            LEFT JOIN profiles p ON p.id = w.user_id
            WHERE ${where}
            ORDER BY ${orderBy}
            LIMIT ${limitParam}
            OFFSET ${offsetParam}
        `

        const { rows } = await dbQuery(sql, params)
        const normalized = (rows || []).map((w: any) => normalizeWrap(w))
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
                w.deleted_at,
                w.download_count,
                w.user_download_count,
                w.price_credits,
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
                p.avatar_url AS profile_avatar_url,
                p.role AS profile_role
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

        // 权限校验：仅作者或管理员可访问私有/已删除贴图
        const user = await getSessionUser();
        const isOwner = user && user.id === wrapRecord.user_id;

        if (wrapRecord.deleted_at && !isOwner) {
            return null;
        }

        if (!wrapRecord.is_active && !isOwner) {
            return null;
        }

        // 注意：is_public 逻辑视业务逻辑而定，如果详情页必须公开才能看，请开启下行
        // if (!wrapRecord.is_public && !isOwner) return null;

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
            ['models-v10'], // Incremented version to force cache refresh
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
            `UPDATE wraps
             SET download_count = COALESCE(download_count, 0) + 1,
                 user_download_count = (
                     SELECT COUNT(DISTINCT ud.user_id)::int
                     FROM user_downloads ud
                     WHERE ud.wrap_id = $1
                 )
             WHERE id = $1`,
            [wrapId]
        )
    } catch (error) {
        console.error('[incrementDownloadCount] RPC failed:', error)
    }
}
