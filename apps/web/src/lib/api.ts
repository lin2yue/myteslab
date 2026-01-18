import { supabase } from '@/lib/supabase'
import type { Wrap, Model } from '@/lib/types'

/**
 * 获取贴图列表（支持分页和车型过滤）
 */
export async function getWraps(modelSlug?: string, page: number = 1, pageSize: number = 12): Promise<Wrap[]> {
    try {
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1

        // 如果指定了车型,先获取车型ID
        if (modelSlug) {
            const { data: model } = await supabase
                .from('wrap_models')
                .select('id')
                .eq('slug', modelSlug)
                .single()

            if (!model) {
                return []
            }

            // 获取该车型的所有贴图ID
            const { data: mappings } = await supabase
                .from('wrap_model_map')
                .select('wrap_id')
                .eq('model_id', model.id)

            if (!mappings || mappings.length === 0) {
                return []
            }

            const wrapIds = mappings.map(m => m.wrap_id)

            // 获取贴图详情（分页）
            const { data, error } = await supabase
                .from('wraps')
                .select('*')
                .in('id', wrapIds)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .range(from, to)

            if (error) {
                console.error('获取带过滤的分页贴图失败:', error)
                return []
            }

            return data || []
        }

        // 获取所有贴图（分页）
        const { data, error } = await supabase
            .from('wraps')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .range(from, to)

        if (error) {
            console.error('获取分页贴图失败:', error)
            return []
        }

        return data || []
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
        const { data, error } = await supabase
            .from('wraps')
            .select('*, wrap_model_map(wrap_models(model_3d_url, slug))')
            .eq('slug', slug)
            .eq('is_active', true)
            .single()

        if (error) {
            console.error('获取贴图详情失败:', error)
            return null
        }

        // 提取关联车型的 3D 模型 URL 和 Slug
        const wrap = data as any
        if (wrap.wrap_model_map && wrap.wrap_model_map.length > 0) {
            const modelInfo = wrap.wrap_model_map[0].wrap_models
            if (modelInfo) {
                if (!wrap.model_3d_url) wrap.model_3d_url = modelInfo.model_3d_url
                wrap.model_slug = modelInfo.slug
            }
        }

        return wrap as Wrap
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
        const { data, error } = await supabase
            .from('wrap_models')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })

        if (error) {
            console.error('获取车型失败:', error)
            return []
        }

        return data || []
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
        // 获取当前计数
        const { data: wrap } = await supabase
            .from('wraps')
            .select('download_count')
            .eq('id', wrapId)
            .single()

        if (wrap) {
            // 更新计数
            await supabase
                .from('wraps')
                .update({ download_count: (wrap.download_count || 0) + 1 })
                .eq('id', wrapId)
        }
    } catch (error) {
        console.error('更新下载计数异常:', error)
    }
}
