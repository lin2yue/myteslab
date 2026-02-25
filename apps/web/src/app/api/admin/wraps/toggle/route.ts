import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const wrapId = typeof body?.wrapId === 'string' ? body.wrapId.trim() : '';
    const isActive = body?.is_active;

    if (!wrapId || typeof isActive !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('wraps')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', wrapId)
        .select('id, is_active')
        .maybeSingle();

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ success: false, error: 'Wrap not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, wrap: data });
}
