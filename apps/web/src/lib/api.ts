import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Wrap, Model } from '@/lib/types'

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
function normalizeWrap(w: any, category: string = 'official'): Wrap {
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'

    // 强制资源走 CDN 的工具函数
    const ensureCdn = (url: string | undefined | null) => {
        if (!url) return ''
        // 如果包含 aliyuncs.com，替换为 cdnURL
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

    return {
        ...w,
        name: w.name || w.prompt || 'Untitled Wrap', // 社区作品默认使用 Prompt 作为标题
        slug: w.slug || w.id,
        wrap_image_url: ensureCdn(w.texture_url || w.wrap_image_url || w.image_url),
        preview_image_url: ensureCdn(w.preview_url || w.preview_image_url),
        image_url: ensureCdn(w.texture_url || w.image_url || ''),
        model_3d_url: ensureCdn(w.model_3d_url),
        category: w.category || category,
        is_active: true,
        download_count: w.download_count || 0,
        // 如果贴图没有日期，给一个较早的基准日期
        created_at: w.created_at || '2024-01-01T00:00:00.000Z'
    } as Wrap
}

/**
 * 获取贴图列表（支持分页和车型过滤）
 */
async function fetchWrapsInternal(
    modelSlug: string | undefined,
    page: number,
    pageSize: number,
    sortBy: 'latest' | 'popular'
): Promise<Wrap[]> {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    if (modelSlug) {
        const { data: model } = await publicSupabase
            .from('wrap_models')
            .select('id')
            .eq('slug', modelSlug)
            .single()

        let officialWraps: any[] = []
        if (model) {
            const { data: mappings } = await publicSupabase
                .from('wrap_model_map')
                .select('wrap_id')
                .eq('model_id', model.id)

            if (mappings && mappings.length > 0) {
                const wrapIds = mappings.map((m: { wrap_id: string }) => m.wrap_id)
                const { data } = await publicSupabase
                    .from('wraps')
                    .select('*')
                    .in('id', wrapIds)
                officialWraps = data || []
            }
        }

        const { data: userWraps } = await publicSupabase
            .from('generated_wraps')
            .select('*')
            .eq('model_slug', modelSlug)
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(100)

        const allWraps = [
            ...(officialWraps || []).map((w: unknown) => normalizeWrap(w as any, 'official')),
            ...(userWraps || []).map((w: unknown) => normalizeWrap(w as any, 'community'))
        ]

        const sortFn = sortBy === 'popular'
            ? (a: Wrap, b: Wrap) => (b.download_count || 0) - (a.download_count || 0)
            : (a: Wrap, b: Wrap) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

        return allWraps
            .sort(sortFn)
            .slice(from, to + 1) as Wrap[]
    }

    // 获取所有贴图（分页）
    // 1. 官方
    const { data: officialData } = await publicSupabase
        .from('wraps')
        .select('*')
    // .eq('is_active', true)

    // 2. 用户公开
    const { data: userData } = await publicSupabase
        .from('generated_wraps')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(100)

    // 3. 合并
    const combinedWraps = [
        ...(officialData || []).map((w: unknown) => normalizeWrap(w as any, 'official')),
        ...(userData || []).map((w: unknown) => normalizeWrap(w as any, 'community'))
    ]

    const sortFn = sortBy === 'popular'
        ? (a: Wrap, b: Wrap) => (b.download_count || 0) - (a.download_count || 0)
        : (a: Wrap, b: Wrap) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

    return combinedWraps
        .sort(sortFn)
        .slice(from, to + 1) as Wrap[]
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
            ['wraps', modelSlug || 'all', String(page), String(pageSize), sortBy],
            { revalidate: 300 }
        )()
    } catch (error) {
        console.error('获取贴图异常:', error)
        return []
    }
}

/**
 * 获取单个贴图详情
 */
export async function getWrap(slug: string): Promise<Wrap | null> {
    try {
        // 1. 先从官方贴图表找
        const { data: officialWrap } = await publicSupabase
            .from('wraps')
            .select('*, wrap_model_map(wrap_models(model_3d_url, slug))')
            .eq('slug', slug)
            .single()

        if (officialWrap) {
            const wrap = { ...officialWrap } as any
            if (wrap.wrap_model_map && wrap.wrap_model_map.length > 0) {
                const modelInfo = wrap.wrap_model_map[0].wrap_models
                if (modelInfo) {
                    if (!wrap.model_3d_url) wrap.model_3d_url = modelInfo.model_3d_url
                    wrap.model_slug = modelInfo.slug
                }
            }
            return normalizeWrap(wrap, 'official')
        }

        // 2. 如果没找到，尝试从用户生成表找 (slug 此时是 UUID)
        const { data: userWrap } = await publicSupabase
            .from('generated_wraps')
            .select('*')
            .eq('id', slug)
            .single()

        if (userWrap) {
            // 获取对应的车型模型 URL
            const { data: model } = await publicSupabase
                .from('wrap_models')
                .select('model_3d_url')
                .eq('slug', userWrap.model_slug)
                .single()

            const wrap = {
                ...userWrap,
                model_3d_url: model?.model_3d_url
            }
            return normalizeWrap(wrap, 'community')
        }

        return null
    } catch (error) {
        console.error('获取贴图详情异常:', error)
        return null
    }
}

/**
 * 获取所有车型
 */
export async function getModels(): Promise<Model[]> {
    try {
        return await unstable_cache(
            async () => {
                const { data, error } = await publicSupabase
                    .from('wrap_models')
                    .select('*')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true })

                if (error) {
                    console.error('获取车型失败:', error)
                    return []
                }

                return data || []
            },
            ['models'],
            { revalidate: 3600 }
        )()
    } catch (error) {
        console.error('获取车型异常:', error)
        return []
    }
}

/**
 * 增加下载计数
 */
export async function incrementDownloadCount(wrapId: string): Promise<void> {
    try {
        const { data: wrap } = await publicSupabase
            .from('wraps')
            .select('download_count')
            .eq('id', wrapId)
            .single()

        if (wrap) {
            await publicSupabase
                .from('wraps')
                .update({ download_count: (wrap.download_count || 0) + 1 })
                .eq('id', wrapId)
        }
    } catch (error) {
        console.error('更新下载计数异常:', error)
    }
}
