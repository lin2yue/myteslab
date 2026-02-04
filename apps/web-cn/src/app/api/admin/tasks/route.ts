import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

    const { rows } = await dbQuery(
        `SELECT
            t.*,
            p.display_name AS profile_display_name,
            p.email AS profile_email
         FROM generation_tasks t
         LEFT JOIN profiles p ON p.id = t.user_id
         ORDER BY t.created_at DESC
         LIMIT $1`,
        [limit]
    );

    const tasks = rows.map((row: any) => ({
        ...row,
        profiles: row.profile_display_name || row.profile_email ? {
            display_name: row.profile_display_name,
            email: row.profile_email,
        } : null
    }));

    return NextResponse.json({ success: true, tasks });
}

