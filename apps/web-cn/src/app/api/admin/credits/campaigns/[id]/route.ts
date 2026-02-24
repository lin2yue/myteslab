import { NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
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

async function getCampaignDetail(client: PoolClient, campaignId: string) {
    const { rows: campaignRows } = await client.query(
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
         WHERE c.id = $1
         LIMIT 1`,
        [campaignId]
    );
    const campaignRow = campaignRows[0];
    if (!campaignRow) return null;

    const { rows: rewardRecords } = await client.query(
        `SELECT
            g.id,
            g.campaign_id,
            g.wrap_id,
            g.user_id,
            g.milestone_downloads,
            g.metric_value,
            g.reward_credits,
            g.created_at,
            g.ledger_id,
            w.name AS wrap_name,
            w.prompt AS wrap_prompt,
            p.display_name AS owner_display_name,
            p.email AS owner_email
         FROM credit_reward_campaign_grants g
         LEFT JOIN wraps w ON w.id = g.wrap_id
         LEFT JOIN profiles p ON p.id = g.user_id
         WHERE g.campaign_id = $1
         ORDER BY g.created_at DESC
         LIMIT 200`,
        [campaignId]
    );

    return {
        campaign: {
            ...normalizeCampaignRow(campaignRow),
            stats: toCampaignStats(campaignRow),
        },
        rewardRecords,
    };
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
        await ensureCreditRewardCampaignTables(client);
        const detail = await getCampaignDetail(client, id);
        if (!detail) {
            return NextResponse.json({ success: false, error: '活动不存在' }, { status: 404 });
        }
        return NextResponse.json({ success: true, ...detail });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin credits campaigns/:id] GET failed:', err);
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
        await ensureCreditRewardCampaignTables(client);
        const { rows: currentRows } = await client.query(
            `SELECT * FROM credit_reward_campaigns WHERE id = $1 LIMIT 1`,
            [id]
        );
        const current = currentRows[0];
        if (!current) {
            return NextResponse.json({ success: false, error: '活动不存在' }, { status: 404 });
        }

        const nextName = body?.name === undefined ? String(current.name) : String(body.name || '').trim();
        const nextStatus = body?.status === undefined
            ? normalizeCampaignStatus(current.status, 'draft')
            : normalizeCampaignStatus(body.status, normalizeCampaignStatus(current.status, 'draft'));
        const nextStartAt = body?.start_at === undefined ? new Date(current.start_at) : toDate(body.start_at);
        const nextEndAt = body?.end_at === undefined ? new Date(current.end_at) : toDate(body.end_at);
        const nextMilestones = body?.milestones === undefined
            ? normalizeCampaignMilestones(current.milestones)
            : normalizeCampaignMilestones(body.milestones);

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
            `UPDATE credit_reward_campaigns
             SET name = $2,
                 status = $3,
                 start_at = $4,
                 end_at = $5,
                 milestones = $6::jsonb,
                 updated_at = NOW()
             WHERE id = $1`,
            [
                id,
                nextName,
                nextStatus,
                nextStartAt.toISOString(),
                nextEndAt.toISOString(),
                JSON.stringify(nextMilestones),
            ]
        );

        const detail = await getCampaignDetail(client, id);
        if (!detail) {
            return NextResponse.json({ success: false, error: '活动不存在' }, { status: 404 });
        }

        return NextResponse.json({ success: true, ...detail });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin credits campaigns/:id] PUT failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}
