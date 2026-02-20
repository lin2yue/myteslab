import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Wrap, Model } from '@/lib/types'
import { DEFAULT_MODELS } from '@/config/models'


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
        author_name: profile?.display_name || (w.category === 'official' ? 'MyTesLab' : 'Anonymous'),
        author_avatar_url: profile?.avatar_url,
        author_username: profile?.display_name,
        download_count: w.download_count || 0,
        user_download_count: w.user_download_count ?? w.download_count ?? 0,
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
    const to = from + pageSize - 1

    try {
        // 使用 Supabase Join 一次性查出作品及作者资料
        // 列表页排除巨大的 texture_url 和 reference_images 以符合 Next.js 2MB 缓存限制
        let query = publicSupabase
            .from('wraps')
            .select(`
                id, 
                slug, 
                name, 
                name_en,
                prompt, 
                category, 
                preview_url, 
                model_slug, 
                user_id, 
                download_count, 
                user_download_count,
                is_public, 
                is_active, 
                created_at, 
                profiles(id, display_name, avatar_url)
            `)
            .eq('is_public', true)
            .eq('is_active', true)

        if (modelSlug) query = query.eq('model_slug', modelSlug)

        if (sortBy === 'popular') {
            query = query.order('user_download_count', { ascending: false }).order('download_count', { ascending: false })
        } else {
            query = query.order('created_at', { ascending: false })
        }

        const { data: rawWraps, error } = await query.range(from, to)
        if (error || !rawWraps) return []

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
            'user_download_count',
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
