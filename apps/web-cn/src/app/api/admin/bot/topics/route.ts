/**
 * /api/admin/bot/topics
 *
 * GET    - 查询选题列表（支持按状态、日期过滤）
 * POST   - Bot Agent 提交新一批选题候选
 * PATCH  - 批准 / 拒绝选题（通过 Telegram 按钮触发）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { dbQuery } from '@/lib/db';

// ── GET /api/admin/bot/topics ──────────────────────────────────────────────
export async function GET(request: NextRequest) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const batchDate = searchParams.get('date') || '';         // YYYY-MM-DD
    const page = Math.max(Number(searchParams.get('page') || 1), 1);
    const pageSize = Math.min(Number(searchParams.get('pageSize') || 20), 50);
    const offset = (page - 1) * pageSize;

    const params: any[] = [];
    const where: string[] = [];

    if (status !== 'all') {
        params.push(status);
        where.push(`btc.status = $${params.length}`);
    }
    if (batchDate) {
        params.push(batchDate);
        where.push(`btc.batch_date = $${params.length}::date`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(pageSize, offset);

    const { rows } = await dbQuery(
        `SELECT
            btc.*,
            bvu.persona_name,
            bvu.persona_key,
            bvu.style_focus,
            w.texture_url AS wrap_texture_url,
            w.slug AS wrap_slug
         FROM bot_topic_candidates btc
         LEFT JOIN bot_virtual_users bvu ON bvu.user_id = btc.virtual_user_id
         LEFT JOIN wraps w ON w.id = btc.wrap_id
         ${whereSql}
         ORDER BY btc.batch_date DESC, btc.trend_score DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );

    const { rows: countRows } = await dbQuery(
        `SELECT COUNT(*) AS total FROM bot_topic_candidates btc ${whereSql}`,
        params.slice(0, -2)
    );

    return NextResponse.json({
        success: true,
        data: rows,
        total: Number(countRows[0]?.total || 0),
        page,
        pageSize,
    });
}

// ── POST /api/admin/bot/topics ─────────────────────────────────────────────
// Bot Agent 提交新一批选题
export async function POST(request: NextRequest) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.topics)) {
        return NextResponse.json({ success: false, error: 'Expected { topics: [...] }' }, { status: 400 });
    }

    type TopicInput = {
        topicName: string;
        colorKeyword?: string;
        styleKeyword?: string;
        modelSlug?: string;
        virtualUserId?: string;
        trendScore?: number;
        sourceUrl?: string;
        suggestedPrompt?: string;
    };

    const { topics } = body as { topics: TopicInput[] };
    const inserted: string[] = [];

    for (const t of topics) {
        if (!t.topicName) continue;
        const { rows } = await dbQuery(
            `INSERT INTO bot_topic_candidates
                (topic_name, color_keyword, style_keyword, model_slug, virtual_user_id,
                 trend_score, source_url, suggested_prompt, status, batch_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', CURRENT_DATE)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [
                t.topicName,
                t.colorKeyword || null,
                t.styleKeyword || null,
                t.modelSlug || 'model-3',
                t.virtualUserId || null,
                t.trendScore || 0,
                t.sourceUrl || null,
                t.suggestedPrompt || null,
            ]
        );
        if (rows[0]?.id) inserted.push(rows[0].id);
    }

    return NextResponse.json({ success: true, inserted: inserted.length, ids: inserted });
}

// ── PATCH /api/admin/bot/topics ────────────────────────────────────────────
// 批准或拒绝选题
export async function PATCH(request: NextRequest) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });

    const { id, action } = body as { id: string; action: 'approve' | 'reject' };

    if (!id || !['approve', 'reject'].includes(action)) {
        return NextResponse.json({ success: false, error: 'Expected { id, action: "approve"|"reject" }' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { rows } = await dbQuery(
        `UPDATE bot_topic_candidates
         SET status = $2,
             approved_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE NULL END,
             approved_by = $3
         WHERE id = $1
           AND status = 'pending'
         RETURNING *`,
        [id, newStatus, admin.id]
    );

    if (!rows[0]) {
        return NextResponse.json({
            success: false,
            error: 'Topic not found or already processed'
        }, { status: 404 });
    }

    return NextResponse.json({ success: true, topic: rows[0] });
}
