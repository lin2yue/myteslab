import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
    ensureOperationCampaignTables,
    normalizeFrequencyCap,
    normalizeOperationCampaignRow,
    normalizeOperationCampaignStatus,
    normalizePlacementKey,
} from '@/lib/operations/campaigns';

function toDate(input: unknown): Date | null {
    if (!input) return null;
    const date = new Date(String(input));
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function toObject(raw: unknown): Record<string, unknown> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw as Record<string, unknown>;
}

function toArchiveDate(raw: unknown, fallback: Date | null) {
    if (raw === undefined) return fallback;
    if (raw === null || raw === '') return null;
    const parsed = toDate(raw);
    return parsed || fallback;
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const client = await db().connect();
    try {
        await ensureOperationCampaignTables(client);
        const { rows } = await client.query(
            `SELECT * FROM operations_campaigns WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (!rows[0]) {
            return NextResponse.json({ success: false, error: '活动不存在' }, { status: 404 });
        }
        return NextResponse.json({ success: true, campaign: normalizeOperationCampaignRow(rows[0]) });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin operations campaigns/:id] GET failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const client = await db().connect();
    try {
        await ensureOperationCampaignTables(client);
        const { rows: currentRows } = await client.query(
            `SELECT * FROM operations_campaigns WHERE id = $1 LIMIT 1`,
            [id]
        );

        const current = currentRows[0];
        if (!current) {
            return NextResponse.json({ success: false, error: '活动不存在' }, { status: 404 });
        }

        const nextName = body?.name === undefined ? String(current.name) : String(body.name || '').trim();
        const nextPlacement = body?.placement_key === undefined ? normalizePlacementKey(current.placement_key) : normalizePlacementKey(body.placement_key, normalizePlacementKey(current.placement_key));
        const nextStatus = body?.status === undefined ? normalizeOperationCampaignStatus(current.status, 'draft') : normalizeOperationCampaignStatus(body.status, normalizeOperationCampaignStatus(current.status, 'draft'));
        const nextStartAt = body?.start_at === undefined ? new Date(current.start_at) : toDate(body.start_at);
        const nextEndAt = body?.end_at === undefined ? new Date(current.end_at) : toDate(body.end_at);
        const nextTrafficRatio = body?.traffic_ratio === undefined ? Number(current.traffic_ratio || 100) : Number(body.traffic_ratio);
        const nextPriority = body?.priority === undefined ? Number(current.priority || 0) : Number(body.priority);
        const nextFrequencyCap = body?.frequency_cap === undefined ? normalizeFrequencyCap(current.frequency_cap) : normalizeFrequencyCap(body.frequency_cap);
        const nextAudience = body?.audience === undefined ? toObject(current.audience) : toObject(body.audience);
        const nextTriggerConfig = body?.trigger_config === undefined ? toObject(current.trigger_config) : toObject(body.trigger_config);
        const nextContent = body?.content === undefined ? toObject(current.content) : toObject(body.content);
        const nextActionConfig = body?.action_config === undefined ? toObject(current.action_config) : toObject(body.action_config);
        const nextArchivedAt = toArchiveDate(body?.archived_at, current.archived_at ? new Date(current.archived_at) : null);

        if (!nextName) {
            return NextResponse.json({ success: false, error: '活动名称不能为空' }, { status: 400 });
        }
        if (!nextStartAt || !nextEndAt) {
            return NextResponse.json({ success: false, error: '开始时间或结束时间无效' }, { status: 400 });
        }
        if (nextEndAt <= nextStartAt) {
            return NextResponse.json({ success: false, error: '结束时间必须晚于开始时间' }, { status: 400 });
        }

        await client.query(
            `UPDATE operations_campaigns
             SET name = $2,
                 placement_key = $3,
                 status = $4,
                 start_at = $5,
                 end_at = $6,
                 traffic_ratio = $7,
                 priority = $8,
                 frequency_cap = $9::jsonb,
                 audience = $10::jsonb,
                 trigger_config = $11::jsonb,
                 content = $12::jsonb,
                 action_config = $13::jsonb,
                 archived_at = $14,
                 updated_at = NOW()
             WHERE id = $1`,
            [
                id,
                nextName,
                nextPlacement,
                nextStatus,
                nextStartAt.toISOString(),
                nextEndAt.toISOString(),
                Math.max(0, Math.min(100, Math.floor(nextTrafficRatio))),
                Math.max(-999, Math.min(999, Math.floor(nextPriority))),
                JSON.stringify(nextFrequencyCap),
                JSON.stringify(nextAudience),
                JSON.stringify(nextTriggerConfig),
                JSON.stringify(nextContent),
                JSON.stringify(nextActionConfig),
                nextArchivedAt ? nextArchivedAt.toISOString() : null,
            ]
        );

        const { rows: latestRows } = await client.query(
            `SELECT * FROM operations_campaigns WHERE id = $1 LIMIT 1`,
            [id]
        );

        return NextResponse.json({ success: true, campaign: normalizeOperationCampaignRow(latestRows[0]) });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin operations campaigns/:id] PUT failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    const client = await db().connect();
    try {
        await ensureOperationCampaignTables(client);
        const { rows: currentRows } = await client.query(
            `SELECT * FROM operations_campaigns WHERE id = $1 LIMIT 1`,
            [id]
        );
        const current = currentRows[0];
        if (!current) {
            return NextResponse.json({ success: false, error: '活动不存在' }, { status: 404 });
        }

        if (action === 'duplicate') {
            const duplicateName = `${String(current.name || '活动')}（复制）`;
            const { rows } = await client.query(
                `INSERT INTO operations_campaigns (
                    name, placement_key, status, start_at, end_at, traffic_ratio, priority,
                    frequency_cap, audience, trigger_config, content, action_config,
                    archived_at, created_by, created_at, updated_at
                ) VALUES (
                    $1, $2, 'draft', $3, $4, $5, $6,
                    $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb,
                    NULL, $12, NOW(), NOW()
                )
                RETURNING *`,
                [
                    duplicateName,
                    normalizePlacementKey(current.placement_key),
                    new Date(current.start_at).toISOString(),
                    new Date(current.end_at).toISOString(),
                    Number(current.traffic_ratio || 100),
                    Number(current.priority || 0),
                    JSON.stringify(normalizeFrequencyCap(current.frequency_cap)),
                    JSON.stringify(toObject(current.audience)),
                    JSON.stringify(toObject(current.trigger_config)),
                    JSON.stringify(toObject(current.content)),
                    JSON.stringify(toObject(current.action_config)),
                    admin.id,
                ]
            );
            return NextResponse.json({ success: true, campaign: normalizeOperationCampaignRow(rows[0]) });
        }

        if (action === 'offline') {
            await client.query(
                `UPDATE operations_campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1`,
                [id]
            );
        } else if (action === 'archive') {
            await client.query(
                `UPDATE operations_campaigns SET archived_at = NOW(), updated_at = NOW() WHERE id = $1`,
                [id]
            );
        } else if (action === 'unarchive') {
            await client.query(
                `UPDATE operations_campaigns SET archived_at = NULL, updated_at = NOW() WHERE id = $1`,
                [id]
            );
        } else {
            return NextResponse.json({ success: false, error: '不支持的动作' }, { status: 400 });
        }

        const { rows: latestRows } = await client.query(
            `SELECT * FROM operations_campaigns WHERE id = $1 LIMIT 1`,
            [id]
        );
        return NextResponse.json({ success: true, campaign: normalizeOperationCampaignRow(latestRows[0]) });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin operations campaigns/:id] POST failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}
