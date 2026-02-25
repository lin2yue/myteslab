import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import { getActiveModels } from '@/config/models';

export async function GET() {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('wrap_models')
        .select('slug, name, name_en, model_3d_url, wheel_url, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        const fallbackModels = getActiveModels().map((model) => ({
            slug: model.slug,
            name: model.name,
            name_en: model.name_en || null,
            model_3d_url: model.model_3d_url,
            wheel_url: model.wheel_url || null,
        }));
        return NextResponse.json({ success: true, models: fallbackModels, fallback: true });
    }

    return NextResponse.json({ success: true, models: data || [] });
}
