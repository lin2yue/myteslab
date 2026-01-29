import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Wrap, Model } from '@/lib/types'
import { DEFAULT_MODELS } from '@/config/models'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const publicSupabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
})

/**
 * 将数据库记录规范化为 Wrap 接口格式
 */
function normalizeWrap(w: any): Wrap {
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'

    const ensureCdn = (url: string | undefined | null) => {
        if (!url) return ''
        if (url.includes('aliyuncs.com')) {
            try {
                const urlObj = new URL(url)
                return `${cdnUrl}${urlObj.pathname}${urlObj.search}`
            } catch (e) {
                return url
            }
        }
        return url
    }

    // 作者信息现在 100% 来源于数据库
    const profile = w.profiles;

    return {
        ...w,
        name: w.name || w.prompt || 'Untitled Wrap',
        name_en: w.name_en || w.name || w.prompt || 'Untitled Wrap',
        description: w.description || '',
        description_en: w.description_en || w.description || '',
        slug: w.slug || w.id,
        wrap_image_url: w.texture_url ? ensureCdn(w.texture_url) : undefined,
        preview_image_url: w.preview_url ? ensureCdn(w.preview_url) : undefined,
        image_url: w.texture_url ? ensureCdn(w.texture_url) : undefined,
        model_slug: w.model_slug,
        category: w.category || 'ai_generated', // Maintain a safe fallback for display
        is_active: true,
        author_name: profile?.display_name || (w.category === 'official' ? 'MyTesLab' : 'Anonymous'),
        author_avatar_url: profile?.avatar_url,
        author_username: profile?.display_name,
        download_count: w.download_count || 0,
        created_at: w.created_at || new Date().toISOString(),
        reference_images: Array.isArray(w.reference_images)
            ? w.reference_images.map((img: any) => typeof img === 'string' ? ensureCdn(img) : null).filter(Boolean)
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
            ['wraps-v6', modelSlug || 'all', String(page), sortBy],
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
                is_public, 
                is_active, 
                created_at, 
                profiles(id, display_name, avatar_url)
            `)
            .eq('is_public', true)

        if (modelSlug) query = query.eq('model_slug', modelSlug)

        if (sortBy === 'popular') {
            query = query.order('download_count', { ascending: false })
        } else {
            query = query.order('created_at', { ascending: false })
        }

        const { data: rawWraps, error } = await query.range(from, to)
        if (error || !rawWraps) return []

        const normalized = rawWraps.map(w => normalizeWrap(w))
        // 移除过多的调试日志输出，仅记录关键信息
        const totalSize = Buffer.byteLength(JSON.stringify(normalized))
        if (totalSize > 1024 * 1024) {
            console.warn(`[WARN] fetchWrapsInternal result is still large: ${totalSize} bytes`)
        }
        return normalized

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
        let query = supabaseClient.from('wraps').select('*');

        if (isUuid) {
            query = query.eq('id', slugOrId);
        } else {
            query = query.eq('slug', slugOrId);
        }

        const { data: wrapData, error } = await query.single();

        if (error || !wrapData) {
            // 如果按 Slug 没查到，且不是 UUID，再尝试按 ID 查一下（容错）
            if (!isUuid) {
                const { data: retryData } = await supabaseClient.from('wraps').select('*').eq('id', slugOrId).single();
                if (retryData) return normalizeWrap({ ...retryData });
            }
            return null;
        }

        // 详情页也统一拉取 Profile
        let profiles = null
        if (wrapData.user_id) {
            const { data, error: profileError } = await supabaseClient.from('profiles').select('display_name, avatar_url').eq('id', wrapData.user_id).single()
            if (profileError) {
                console.error('[Debug] Failed to fetch profile for user:', wrapData.user_id, profileError)
            } else {
                console.log('[Debug] Fetched profile:', data)
            }
            profiles = data
        } else {
            console.log('[Debug] Wrap has no user_id:', wrapData.id)
        }

        // 补齐模型预览链接
        if (!wrapData.model_3d_url && wrapData.model_slug) {
            const { data: model } = await supabaseClient.from('wrap_models').select('model_3d_url').eq('slug', wrapData.model_slug).single()
            wrapData.model_3d_url = model?.model_3d_url
        }

        return normalizeWrap({ ...wrapData, profiles })
    } catch (error) {
        console.error('获取贴图详情异常:', error)
        return null
    }
}

export async function getModels(): Promise<Model[]> {
    try {
        return await unstable_cache(
            async () => {
                console.log('[getModels] Fetching from database...')

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
                    console.log(`[getModels] Retrieved ${models.length} models from database`)

                    // Merge local config (specifically wheel_url which is missing in DB)
                    const mergedModels = models.map((m: any) => {
                        const localConfig = DEFAULT_MODELS.find(dm => dm.slug === m.slug)
                        return {
                            ...m,
                            wheel_url: m.wheel_url || localConfig?.wheel_url
                        }
                    })

                    // Inject local-only models that are missing from DB
                    // Questo ensures that new models added to code but not yet in DB (e.g. migrated ones) are visible
                    const dbSlugs = new Set(models.map((m: any) => m.slug))
                    const localOnlyModels = DEFAULT_MODELS.filter(dm => !dbSlugs.has(dm.slug)).map(dm => ({
                        ...dm,
                        id: dm.slug, // Mock ID for frontend keys
                        created_at: new Date().toISOString()
                    }))

                    const finalModels = [...mergedModels, ...localOnlyModels].sort((a: any, b: any) => (a.sort_order || 99) - (b.sort_order || 99))

                    return finalModels as Model[]
                } catch (dbError) {
                    console.error('[getModels] Database query failed, using fallback:', dbError)
                    // Import fallback config
                    const { DEFAULT_MODELS } = await import('@/config/models')
                    return DEFAULT_MODELS as Model[]
                }
            },
            ['models-v7'], // Incremented version to force cache refresh
            { revalidate: 3600 }
        )()
    } catch (error) {
        console.error('[getModels] Fatal error, using fallback:', error)
        // Last resort fallback
        const { DEFAULT_MODELS } = await import('@/config/models')
        return DEFAULT_MODELS as Model[]
    }
}

export async function incrementDownloadCount(wrapId: string): Promise<void> {
    try {
        await publicSupabase.rpc('increment_download_count', { wrap_id: wrapId })
    } catch (error) {
        const { data } = await publicSupabase.from('wraps').select('download_count').eq('id', wrapId).single()
        if (data) await publicSupabase.from('wraps').update({ download_count: (data.download_count || 0) + 1 }).eq('id', wrapId)
    }
}
