import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';
import {
    ensureCreditRewardCampaignTables,
    normalizeCampaignMilestones,
    normalizeCampaignRow,
    normalizeCampaignStatus,
} from '@/lib/credits/campaigns';

function toDate(input: unknown): Date | null {
    if (!input) return null;
    const date = new Date(String(input));
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function toCampaignStats(row: Record<string, unknown>) {
    return {
        qualified_wraps: Number(row.qualified_wraps || 0),
        total_grants: Number(row.total_grants || 0),
        total_reward_credits: Number(row.total_reward_credits || 0),
    };
}

export async function GET() {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const client = await db().connect();
    try {
        await ensureCreditRewardCampaignTables(client);
        const { rows } = await client.query(
            `SELECT
                c.*,
                COALESCE(s.qualified_wraps, 0)::bigint AS qualified_wraps,
                COALESCE(s.total_grants, 0)::bigint AS total_grants,
                COALESCE(s.total_reward_credits, 0)::bigint AS total_reward_credits
             FROM credit_reward_campaigns c
             LEFT JOIN (
                SELECT
                    campaign_id,
                    COUNT(DISTINCT wrap_id) AS qualified_wraps,
                    COUNT(*) AS total_grants,
                    COALESCE(SUM(reward_credits), 0) AS total_reward_credits
                FROM credit_reward_campaign_grants
                GROUP BY campaign_id
             ) s ON s.campaign_id = c.id
             ORDER BY c.created_at DESC`
        );

        const campaigns = rows.map((row) => ({
            ...normalizeCampaignRow(row),
            stats: toCampaignStats(row),
        }));

        return NextResponse.json({ success: true, campaigns });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin credits campaigns] GET failed:', err);
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
    const startAt = toDate(body?.start_at);
    const endAt = toDate(body?.end_at);
    const milestones = normalizeCampaignMilestones(body?.milestones);
    const status = normalizeCampaignStatus(body?.status, 'draft');

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
        await ensureCreditRewardCampaignTables(client);
        const { rows } = await client.query(
            `INSERT INTO credit_reward_campaigns (
                name,
                status,
                start_at,
                end_at,
                milestones,
                created_by,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW(), NOW())
            RETURNING *`,
            [
                name,
                status,
                startAt.toISOString(),
                endAt.toISOString(),
                JSON.stringify(milestones),
                admin.id,
            ]
        );

        const campaign = normalizeCampaignRow(rows[0]);
        return NextResponse.json({ success: true, campaign });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin credits campaigns] POST failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}

