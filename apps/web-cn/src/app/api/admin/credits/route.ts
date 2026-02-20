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
    const type = searchParams.get('type');

    let query = `
        SELECT
            l.*,
            p.display_name AS profile_display_name,
            p.email AS profile_email
         FROM credit_ledger l
         LEFT JOIN profiles p ON p.id = l.user_id
    `;

    const queryParams: any[] = [limit];

    if (type && type !== 'all') {
        query += ` WHERE l.type = $2`;
        queryParams.push(type);
    }

    query += ` ORDER BY l.created_at DESC LIMIT $1`;

    const [listRes, topUpSummaryRes, topUpUsersRes] = await Promise.all([
        dbQuery(query, queryParams),
        dbQuery(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'top-up' THEN amount ELSE 0 END), 0)::bigint AS total_top_up_credits,
                COUNT(DISTINCT CASE WHEN type = 'top-up' THEN user_id END)::bigint AS top_up_users
             FROM credit_ledger`
        ),
        dbQuery(
            `SELECT
                l.user_id,
                COALESCE(SUM(l.amount), 0)::bigint AS total_top_up_credits,
                COUNT(*)::int AS top_up_count,
                MAX(l.created_at) AS latest_top_up_at,
                p.display_name AS profile_display_name,
                p.email AS profile_email
             FROM credit_ledger l
             LEFT JOIN profiles p ON p.id = l.user_id
             WHERE l.type = 'top-up'
             GROUP BY l.user_id, p.display_name, p.email
             ORDER BY total_top_up_credits DESC
             LIMIT 50`
        )
    ]);

    const rows = listRes.rows;

    const logs = rows.map((row: any) => ({
        ...row,
        profiles: row.profile_display_name || row.profile_email ? {
            display_name: row.profile_display_name,
            email: row.profile_email,
        } : null
    }));

    const topUpSummary = {
        total_top_up_credits: Number((topUpSummaryRes.rows?.[0] as any)?.total_top_up_credits || 0),
        top_up_users: Number((topUpSummaryRes.rows?.[0] as any)?.top_up_users || 0),
    };

    const topUpUsers = topUpUsersRes.rows.map((row: any) => ({
        user_id: row.user_id,
        total_top_up_credits: Number(row.total_top_up_credits || 0),
        top_up_count: Number(row.top_up_count || 0),
        latest_top_up_at: row.latest_top_up_at,
        profiles: row.profile_display_name || row.profile_email ? {
            display_name: row.profile_display_name,
            email: row.profile_email,
        } : null
    }));

    return NextResponse.json({ success: true, logs, topUpSummary, topUpUsers });
}
