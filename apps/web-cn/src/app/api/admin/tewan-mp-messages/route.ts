import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const direction = searchParams.get('direction') || 'all';
    const q = (searchParams.get('q') || '').trim();
    const limitRaw = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

    const params: any[] = [];
    const where: string[] = [`source_account = 'tewan'`];

    if (direction !== 'all') {
        params.push(direction);
        where.push(`direction = $${params.length}`);
    }

    if (q) {
        params.push(`%${q}%`);
        const idx = params.length;
        where.push(`(openid ILIKE $${idx} OR content ILIKE $${idx} OR dedup_key ILIKE $${idx} OR reply_strategy ILIKE $${idx})`);
    }

    params.push(limit);
    const limitIdx = params.length;

    const { rows } = await dbQuery(
        `SELECT id, source_account, openid, direction, msg_type, event, event_key, msg_id, dedup_key, content, reply_strategy, created_at
         FROM tewan_mp_message_logs
         WHERE ${where.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT $${limitIdx}`,
        params
    );

    const { rows: statsRows } = await dbQuery(`
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE direction = 'inbound')::int AS inbound_count,
            COUNT(*) FILTER (WHERE direction = 'outbound')::int AS outbound_count,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS last_7_days
        FROM tewan_mp_message_logs
        WHERE source_account = 'tewan'
    `);

    return NextResponse.json({
        success: true,
        items: rows,
        stats: statsRows[0] || { total: 0, inbound_count: 0, outbound_count: 0, last_7_days: 0 }
    });
}
