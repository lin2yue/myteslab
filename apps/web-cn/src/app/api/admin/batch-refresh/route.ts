import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET() {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const [wrapsRes, modelsRes] = await Promise.all([
        dbQuery(
            `SELECT id, model_slug, texture_url, preview_url, name, created_at
             FROM wraps
             WHERE deleted_at IS NULL
             ORDER BY created_at DESC`
        ),
        dbQuery(
            `SELECT slug, name, name_en, model_3d_url, wheel_url
             FROM wrap_models
             ORDER BY sort_order ASC`
        )
    ]);

    return NextResponse.json({
        success: true,
        wraps: wrapsRes.rows,
        models: modelsRes.rows
    });
}

