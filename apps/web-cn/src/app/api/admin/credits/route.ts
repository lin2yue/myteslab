import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 100), 200);

    const { rows } = await dbQuery(
        `SELECT
            l.*,
            p.display_name AS profile_display_name,
            p.email AS profile_email
         FROM credit_ledger l
         LEFT JOIN profiles p ON p.id = l.user_id
         ORDER BY l.created_at DESC
         LIMIT $1`,
        [limit]
    );

    const logs = rows.map((row: any) => ({
        ...row,
        profiles: row.profile_display_name || row.profile_email ? {
            display_name: row.profile_display_name,
            email: row.profile_email,
        } : null
    }));

    return NextResponse.json({ success: true, logs });
}

