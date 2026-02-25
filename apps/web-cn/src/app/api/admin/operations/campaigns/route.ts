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

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('include_archived') === '1';

    const client = await db().connect();
    try {
        await ensureOperationCampaignTables(client);
        const { rows } = await client.query(
            `
            SELECT *
            FROM operations_campaigns
            WHERE ($1::boolean = true OR archived_at IS NULL)
            ORDER BY archived_at ASC NULLS FIRST, updated_at DESC
            LIMIT 200
        `,
            [includeArchived]
        );

        const campaigns = rows.map((row) => normalizeOperationCampaignRow(row));
        return NextResponse.json({ success: true, campaigns });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin operations campaigns] GET failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function POST(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    const name = String(body?.name || '').trim();
    const placementKey = normalizePlacementKey(body?.placement_key);
    const status = normalizeOperationCampaignStatus(body?.status, 'draft');
    const startAt = toDate(body?.start_at);
    const endAt = toDate(body?.end_at);
    const trafficRatio = Math.max(0, Math.min(100, Math.floor(Number(body?.traffic_ratio ?? 100))));
    const priority = Math.max(-999, Math.min(999, Math.floor(Number(body?.priority ?? 0))));
    const frequencyCap = normalizeFrequencyCap(body?.frequency_cap);
    const audience = toObject(body?.audience);
    const triggerConfig = toObject(body?.trigger_config);
    const content = toObject(body?.content);
    const actionConfig = toObject(body?.action_config);

    if (!name) {
        return NextResponse.json({ success: false, error: '活动名称不能为空' }, { status: 400 });
    }
    if (!startAt || !endAt) {
        return NextResponse.json({ success: false, error: '开始时间或结束时间无效' }, { status: 400 });
    }
    if (endAt <= startAt) {
        return NextResponse.json({ success: false, error: '结束时间必须晚于开始时间' }, { status: 400 });
    }

    const client = await db().connect();
    try {
        await ensureOperationCampaignTables(client);

        const { rows } = await client.query(
            `INSERT INTO operations_campaigns (
                name,
                placement_key,
                status,
                start_at,
                end_at,
                traffic_ratio,
                priority,
                frequency_cap,
                audience,
                trigger_config,
                content,
                action_config,
                created_by,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb,
                $13, NOW(), NOW()
            )
            RETURNING *`,
            [
                name,
                placementKey,
                status,
                startAt.toISOString(),
                endAt.toISOString(),
                trafficRatio,
                priority,
                JSON.stringify(frequencyCap),
                JSON.stringify(audience),
                JSON.stringify(triggerConfig),
                JSON.stringify(content),
                JSON.stringify(actionConfig),
                admin.id,
            ]
        );

        return NextResponse.json({ success: true, campaign: normalizeOperationCampaignRow(rows[0]) });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin operations campaigns] POST failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}
