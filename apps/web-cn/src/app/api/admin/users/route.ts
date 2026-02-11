import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || 'all';

    const params: any[] = [];
    let where = '';
    if (role !== 'all') {
        params.push(role);
        where = `WHERE p.role = $1`;
    }

    const { rows } = await dbQuery(
        `SELECT
            p.id,
            p.email,
            p.display_name,
            p.avatar_url,
            p.role,
            p.created_at,
            uc.balance,
            (SELECT COUNT(*) FROM user_downloads ud WHERE ud.user_id = p.id) as download_count,
            (SELECT COALESCE(SUM(amount), 0) FROM credit_ledger cl WHERE cl.user_id = p.id AND cl.type = 'top-up') as total_top_up
         FROM profiles p
         LEFT JOIN user_credits uc ON uc.user_id = p.id
         ${where}
         ORDER BY p.created_at DESC`,
        params
    );

    const users = rows.map((row: any) => ({
        ...row,
        download_count: parseInt(row.download_count || '0'),
        total_top_up: parseFloat(row.total_top_up || '0'),
        user_credits: {
            balance: row.balance ?? 0
        }
    }));

    return NextResponse.json({ success: true, users });
}

