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
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!wrapId || !name) {
        return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    if (name.length > 200) {
        return NextResponse.json({ success: false, error: 'Name is too long (max 200 chars)' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('wraps')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', wrapId)
        .select('id, name, updated_at')
        .maybeSingle();

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ success: false, error: 'Wrap not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, wrap: data });
}
