import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Wrap, Model } from '@/lib/types'
import { DEFAULT_MODELS } from '@/config/models'


export type WrapSortBy = 'recommended' | 'popular' | 'latest'

const RECOMMENDED_MIN_POOL_SIZE = 180
const RECOMMENDED_MAX_POOL_SIZE = 720
const RECOMMENDED_POOL_MULTIPLIER = 8
const RECOMMENDED_POPULAR_WEIGHT = 0.55
const RECOMMENDED_FRESH_WEIGHT = 0.45
const RECOMMENDED_FRESH_DECAY_HOURS = 168
const RECOMMENDED_HEAD_FRESH_HOURS = 72
const RECOMMENDED_HEAD_MIN_HEAT = 1
const RECOMMENDED_HEAD_MAX_HEAT = 12

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('[API] Missing Supabase env vars for public client')
}

const publicSupabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
})

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
                const { data, error } = await publicSupabase
                    .from('wrap_models')
                    .select('slug, name, name_en, model_3d_url')
                    .eq('is_active', true)
                    .in('slug', uniqueSlugs)

                if (error) {
                    console.error('[getModelsBySlugs] Supabase error:', error)
                    throw error
                }

                const models = (data || []) as Model[]
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
    // 作者信息现在 100% 来源于数据库
    const profile = w.profiles;
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
        author_name: profile?.display_name || (w.category === 'official' ? 'MyTesLab' : 'Anonymous'),
        author_avatar_url: profile?.avatar_url,
        author_username: profile?.display_name,
        download_count: w.download_count || 0,
        user_download_count: w.user_download_count ?? w.download_count ?? 0, // user_download_count may not exist in this DB
        created_at: w.created_at || new Date().toISOString(),
        reference_images: Array.isArray(w.reference_images)
            ? w.reference_images.map((img: any) => typeof img === 'string' ? ensureCdnUrl(img) : null).filter(Boolean)
            : []
    } as Wrap
}

function normalizeSearchQuery(searchQuery?: string): string {
    return (searchQuery || '').trim().replace(/\s+/g, ' ')
}

function toSupabaseIlikePattern(searchQuery: string): string {
    // Supabase filter syntax uses commas/parentheses as operators; strip them from user input.
    const sanitized = searchQuery.replace(/[(),]/g, ' ').replace(/%/g, ' ').replace(/\s+/g, ' ').trim()
    if (!sanitized) return ''
    return `%${sanitized}%`
}

function getWrapBaseHeat(row: any): number {
    const value = Number(row?.user_download_count ?? row?.download_count ?? 0)
    return Number.isFinite(value) && value > 0 ? value : 0
}

function getWrapCreatedAtMs(row: any): number {
    const parsed = Date.parse(String(row?.created_at || ''))
    return Number.isFinite(parsed) ? parsed : 0
}

function getWrapAgeHours(row: any): number {
    const createdAtMs = getWrapCreatedAtMs(row)
    if (!createdAtMs) return 24 * 365
    const ageMs = Date.now() - createdAtMs
    if (!Number.isFinite(ageMs) || ageMs < 0) return 0
    return ageMs / (1000 * 60 * 60)
}

function getRecommendedScore(row: any): number {
    const heat = getWrapBaseHeat(row)
    const popularPart = Math.log1p(heat)
    const freshPart = Math.exp(-getWrapAgeHours(row) / RECOMMENDED_FRESH_DECAY_HOURS)
    return (RECOMMENDED_POPULAR_WEIGHT * popularPart) + (RECOMMENDED_FRESH_WEIGHT * freshPart)
}

function isHeadFreshCandidate(row: any): boolean {
    const heat = getWrapBaseHeat(row)
    if (heat < RECOMMENDED_HEAD_MIN_HEAT || heat > RECOMMENDED_HEAD_MAX_HEAT) return false
    return getWrapAgeHours(row) <= RECOMMENDED_HEAD_FRESH_HOURS
}

function dedupeWrapRows(rows: any[]): any[] {
    const deduped = new Map<string, any>()
    for (const row of rows) {
        const id = row?.id ? String(row.id) : ''
        if (!id || deduped.has(id)) continue
        deduped.set(id, row)
    }
    return Array.from(deduped.values())
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
        let query = publicSupabase
            .from('wraps')
            .select('name, name_en')
            .eq('is_public', true)
            .eq('is_active', true)
            .order('download_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(Math.max(limit * 4, 24))

        if (modelSlug) query = query.eq('model_slug', modelSlug)

        const { data, error } = await query
        if (error || !data) return []

        const rows = data as WrapKeywordRow[]
        const seen = new Set<string>()
        const keywords: string[] = []

        for (const row of rows) {
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
    const to = from + pageSize - 1

    try {
        const pattern = searchQuery ? toSupabaseIlikePattern(searchQuery) : ''
        const selectFields = `
            id, 
            slug, 
            name, 
            name_en,
            prompt, 
            category, 
            texture_url,
            preview_url, 
            model_slug, 
            user_id, 
            download_count, 
            is_public, 
            is_active, 
            created_at, 
            profiles(id, display_name, avatar_url)
        `

        const buildBaseQuery = () => {
            let baseQuery = publicSupabase
                .from('wraps')
                .select(selectFields)
                .eq('is_public', true)
                .eq('is_active', true)

            if (modelSlug) baseQuery = baseQuery.eq('model_slug', modelSlug)
            if (pattern) {
                baseQuery = baseQuery.or(`name.ilike.${pattern},name_en.ilike.${pattern},prompt.ilike.${pattern}`)
            }
            return baseQuery
        }

        let rawWraps: any[] | null = null
        if (sortBy === 'recommended') {
            const candidateSize = Math.min(
                RECOMMENDED_MAX_POOL_SIZE,
                Math.max((to + 1) * RECOMMENDED_POOL_MULTIPLIER, RECOMMENDED_MIN_POOL_SIZE)
            )

            const [popularResult, latestResult] = await Promise.all([
                buildBaseQuery()
                    .order('download_count', { ascending: false })
                    .order('created_at', { ascending: false })
                    .range(0, candidateSize - 1),
                buildBaseQuery()
                    .order('created_at', { ascending: false })
                    .range(0, candidateSize - 1),
            ])

            if (popularResult.error || latestResult.error) return []

            const merged = dedupeWrapRows([...(popularResult.data || []), ...(latestResult.data || [])])
            merged.sort((a, b) => {
                const headFreshDiff = Number(isHeadFreshCandidate(b)) - Number(isHeadFreshCandidate(a))
                if (headFreshDiff !== 0) return headFreshDiff

                if (isHeadFreshCandidate(a) && isHeadFreshCandidate(b)) {
                    const freshCreatedAtDiff = getWrapCreatedAtMs(b) - getWrapCreatedAtMs(a)
                    if (freshCreatedAtDiff !== 0) return freshCreatedAtDiff
                }

                const scoreDiff = getRecommendedScore(b) - getRecommendedScore(a)
                if (Math.abs(scoreDiff) > Number.EPSILON) return scoreDiff

                const heatDiff = getWrapBaseHeat(b) - getWrapBaseHeat(a)
                if (heatDiff !== 0) return heatDiff

                const createdAtDiff = getWrapCreatedAtMs(b) - getWrapCreatedAtMs(a)
                if (createdAtDiff !== 0) return createdAtDiff

                return String(b?.id || '').localeCompare(String(a?.id || ''))
            })
            rawWraps = merged.slice(from, to + 1)
        } else {
            let query = buildBaseQuery()
            if (sortBy === 'popular') {
                query = query.order('download_count', { ascending: false }).order('created_at', { ascending: false })
            } else {
                query = query.order('created_at', { ascending: false })
            }

            const { data, error } = await query.range(from, to)
            if (error || !data) return []
            rawWraps = data
        }
        if (!rawWraps) return []

        const normalized = rawWraps.map(w => normalizeWrap(w))
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

export async function getWrap(slugOrId: string, supabaseClient = publicSupabase): Promise<Wrap | null> {
    try {
        // 判断是否为 UUID 格式 (8-4-4-4-12)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

        // 构建查询：如果是 UUID，优先查 ID；否则查 Slug
        const selectFields = [
            'id',
            'slug',
            'name',
            'name_en',
            'description',
            'description_en',
            'prompt',
            'texture_url',
            'preview_url',
            'model_slug',
            'category',
            'is_active',
            'is_public',
            'user_id',
            'download_count',
            'created_at',
            'reference_images'
        ].join(',');
        let query = supabaseClient.from('wraps').select(selectFields);

        if (isUuid) {
            query = query.eq('id', slugOrId);
        } else {
            query = query.eq('slug', slugOrId);
        }

        const { data: wrapData, error } = await query.single();

        if (error && process.env.NODE_ENV === 'development') {
            console.error('[getWrap] query error:', error.message, 'slugOrId:', slugOrId);
        }

        if (error || !wrapData) {
            // 如果按 Slug 没查到，且不是 UUID，再尝试按 ID 查一下（容错）
            if (!isUuid) {
                const { data: retryData, error: retryError } = await supabaseClient.from('wraps').select(selectFields).eq('id', slugOrId).single();
                if (retryError && process.env.NODE_ENV === 'development') {
                    console.error('[getWrap] retry error:', retryError.message, 'slugOrId:', slugOrId);
                }
                if (retryData) return normalizeWrap(retryData as any);
            }
            return null;
        }

        // 详情页也统一拉取 Profile
        const wrapRecord = wrapData as any;
        let profiles = null
        if (wrapRecord?.user_id) {
            const { data, error: profileError } = await supabaseClient.from('profiles').select('display_name, avatar_url').eq('id', wrapRecord.user_id).single()
            if (profileError) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('[Debug] Failed to fetch profile for user:', wrapRecord.user_id, profileError)
                }
            } else if (process.env.NODE_ENV === 'development') {
                console.log('[Debug] Fetched profile:', data)
            }
            profiles = data
        } else {
            if (process.env.NODE_ENV === 'development') {
                console.log('[Debug] Wrap has no user_id:', wrapRecord?.id)
            }
        }

        // 补齐模型预览链接
        if (!wrapRecord?.model_3d_url && wrapRecord?.model_slug) {
            const { data: model } = await supabaseClient.from('wrap_models').select('model_3d_url').eq('slug', wrapRecord.model_slug).single()
            wrapRecord.model_3d_url = model?.model_3d_url
        }

        const normalized = normalizeWrap({ ...wrapRecord, profiles })
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
                    const { data, error } = await publicSupabase
                        .from('wrap_models')
                        .select('*')
                        .eq('is_active', true)
                        .order('sort_order', { ascending: true })

                    if (error) {
                        console.error('[getModels] Supabase error:', error)
                        throw error
                    }

                    const models = data || []

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
            ['models-v11'], // Incremented version to force cache refresh
            { revalidate: 3600, tags: ['models'] }
        )()
    } catch (error) {
        console.error('[getModels] Fatal error:', error)
        return DEFAULT_MODELS.filter(m => m.is_active) as Model[];
    }
}

export async function incrementDownloadCount(wrapId: string): Promise<void> {
    try {
        await publicSupabase.rpc('increment_download_count', { wrap_id: wrapId })
    } catch (error) {
        console.error('[incrementDownloadCount] RPC failed:', error)
    }
}
