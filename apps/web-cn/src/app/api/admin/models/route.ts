import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET() {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { rows } = await dbQuery(
        `SELECT slug, name, name_en, model_3d_url, wheel_url
         FROM wrap_models
         WHERE is_active = true
         ORDER BY sort_order ASC`
    );

    return NextResponse.json({ success: true, models: rows });
}

