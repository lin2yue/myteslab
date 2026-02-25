import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const category = (searchParams.get('category') || 'all').trim();
    const status = (searchParams.get('status') || 'all').trim();
    const publicFilter = (searchParams.get('public') || 'all').trim();
    const page = Math.max(Number(searchParams.get('page') || 1), 1);
    const pageSize = Math.min(Number(searchParams.get('pageSize') || 12), 100);
    const offset = (page - 1) * pageSize;

    const supabase = createAdminClient();

    let query = supabase
        .from('wraps')
        .select(
            `
            id,
            slug,
            name,
            model_slug,
            category,
            preview_url,
            texture_url,
            prompt,
            reference_images,
            download_count,
            is_active,
            is_public,
            created_at,
            updated_at,
            profiles (
                display_name,
                email,
                avatar_url
            )
            `,
            { count: 'exact' }
        )
        .order('created_at', { ascending: false });

    if (search) {
        query = query.or(`name.ilike.%${search}%,model_slug.ilike.%${search}%,prompt.ilike.%${search}%`);
    }

    if (category !== 'all') {
        query = query.eq('category', category);
    }

    if (status === 'active') {
        query = query.eq('is_active', true);
    } else if (status === 'hidden') {
        query = query.eq('is_active', false);
    }

    if (publicFilter === 'public') {
        query = query.eq('is_public', true);
    } else if (publicFilter === 'private') {
        query = query.eq('is_public', false);
    }

    const { data, error, count } = await query.range(offset, offset + pageSize - 1);

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const wraps = (data || []).map((row: any) => ({
        ...row,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] || null : row.profiles || null,
    }));

    const total = Number(count || 0);
    return NextResponse.json({
        success: true,
        wraps,
        page,
        pageSize,
        total,
        hasMore: offset + wraps.length < total,
    });
}
