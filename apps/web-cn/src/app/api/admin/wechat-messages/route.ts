import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const q = (searchParams.get('q') || '').trim();
    const limitRaw = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

    const params: any[] = [];
    const where: string[] = [];

    if (status !== 'all') {
        params.push(status);
        where.push(`status = $${params.length}`);
    }

    if (q) {
        params.push(`%${q}%`);
        const idx = params.length;
        where.push(`(openid ILIKE $${idx} OR reply_text ILIKE $${idx} OR dedup_key ILIKE $${idx})`);
    }

    params.push(limit);
    const limitIdx = params.length;

    const sql = `
        SELECT
            dedup_key,
            openid,
            msg_type,
            msg_id,
            status,
            reply_text,
            content_hash,
            created_at,
            last_seen_at
        FROM wechat_message_dedup
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY created_at DESC
        LIMIT $${limitIdx}
    `;

    const { rows } = await dbQuery(sql, params);

    const { rows: statsRows } = await dbQuery(`
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'passive_replied')::int AS passive_replied,
            COUNT(*) FILTER (WHERE status = 'async_sent')::int AS async_sent,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS last_7_days
        FROM wechat_message_dedup
    `);

    return NextResponse.json({
        success: true,
        items: rows,
        stats: statsRows[0] || { total: 0, passive_replied: 0, async_sent: 0, last_7_days: 0 }
    });
}
