import { supabase } from './supabase'

const ensureClient = () => {
    if (!supabase) {
        const error = new Error('Supabase client not initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        console.error(error.message);
        return { client: null, error };
    }
    return { client: supabase, error: null };
};

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

export const wrapsService = {
    async fetchModels() {
        const { client, error } = ensureClient();
        if (!client) return { data: [], error };

        const { data, error: queryError } = await client
            .from('wrap_models')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (queryError) {
            console.error('Error fetching wrap models:', queryError);
            return { data: [], error: queryError };
        }

        return { data: data || [], error: null };
    },

    async fetchWraps({ modelId = '', modelSlug = '', category = '', search = '', page = 1, pageSize = 30 } = {}) {
        const { client, error } = ensureClient();
        if (!client) return { data: [], error };

        const safeSearch = normalizeString(search);
        const safeModelId = normalizeString(modelId);
        const safeModelSlug = normalizeString(modelSlug);

        let finalModelSlug = safeModelSlug;

        // 如果只有 modelId，尝试获取 slug (为了兼容旧逻辑)
        if (!finalModelSlug && safeModelId) {
            const { data: model } = await client
                .from('wrap_models')
                .select('slug')
                .eq('id', safeModelId)
                .maybeSingle();
            finalModelSlug = model?.slug || '';
        }

        const from = Math.max(0, (Number(page) - 1) * Number(pageSize));
        const to = from + Number(pageSize) - 1;

        let query = client
            .from('wraps')
            .select('*')
            .eq('is_public', true)
            .is('deleted_at', null);

        if (finalModelSlug) {
            query = query.eq('model_slug', finalModelSlug);
        }

        if (safeSearch) {
            const pattern = `%${safeSearch}%`;
            query = query.or(`name.ilike.${pattern},prompt.ilike.${pattern}`);
        }

        query = query
            .order('created_at', { ascending: false })
            .range(from, to);

        const { data, error: queryError } = await query;

        if (queryError) {
            console.error('Error fetching wraps:', queryError);
            return { data: [], error: queryError };
        }

        // 数据兼容性映射
        const mappedData = (data || []).map(w => ({
            ...w,
            image_url: w.texture_url,
            wrap_image_url: w.texture_url,
            preview_image_url: w.preview_url,
            category: w.category || (w.user_id === '00000000-0000-0000-0000-000000000000' ? 'official' : 'community')
        }));

        return { data: mappedData, error: null };
    },

    async fetchWrapById(id) {
        const { client, error } = ensureClient();
        if (!client) return { data: null, error };

        const wrapId = normalizeString(id);
        if (!wrapId) return { data: null, error: null };

        const { data, error: queryError } = await client
            .from('wraps')
            .select('*')
            .eq('id', wrapId)
            .maybeSingle();

        if (queryError) {
            console.error('Error fetching wrap by id:', queryError);
            return { data: null, error: queryError };
        }

        if (!data) return { data: null, error: null };

        const wrap = {
            ...data,
            image_url: data.texture_url,
            wrap_image_url: data.texture_url,
            preview_image_url: data.preview_url,
            category: data.category || (data.user_id === '00000000-0000-0000-0000-000000000000' ? 'official' : 'community')
        };

        // 如果缺少 3D 模型 URL，从模型配置中补全
        if (!wrap.model_3d_url && wrap.model_slug) {
            const { data: model } = await client
                .from('wrap_models')
                .select('model_3d_url')
                .eq('slug', wrap.model_slug)
                .maybeSingle();
            if (model) wrap.model_3d_url = model.model_3d_url;
        }

        return { data: wrap, error: null };
    },

    async fetchWrapBySlug(slug) {
        const { client, error } = ensureClient();
        if (!client) return { data: null, error };

        const safeSlug = normalizeString(slug);
        if (!safeSlug) return { data: null, error: null };

        const { data, error: queryError } = await client
            .from('wraps')
            .select('*')
            .eq('slug', safeSlug)
            .maybeSingle();

        if (queryError) {
            console.error('Error fetching wrap by slug:', queryError);
            return { data: null, error: queryError };
        }

        if (!data) return { data: null, error: null };

        const wrap = {
            ...data,
            image_url: data.texture_url,
            wrap_image_url: data.texture_url,
            preview_image_url: data.preview_url,
            category: data.category || (data.user_id === '00000000-0000-0000-0000-000000000000' ? 'official' : 'community')
        };

        // 如果缺少 3D 模型 URL，从模型配置中补全
        if (!wrap.model_3d_url && wrap.model_slug) {
            const { data: model } = await client
                .from('wrap_models')
                .select('model_3d_url')
                .eq('slug', wrap.model_slug)
                .maybeSingle();
            if (model) wrap.model_3d_url = model.model_3d_url;
        }

        return { data: wrap, error: null };
    }
};
