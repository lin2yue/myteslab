import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
    ensureOperationCampaignTables,
    normalizeOperationCampaignRow,
} from '@/lib/operations/campaigns';

function asStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}

function asBool(value: unknown, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}

function hashToBucket(input: string) {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const placementKey = String(searchParams.get('placement') || '').trim();
    const viewerKey = String(searchParams.get('viewerKey') || '').trim();

    if (!placementKey) {
        return NextResponse.json({ success: false, error: 'Missing placement' }, { status: 400 });
    }

    const client = await db().connect();
    try {
        await ensureOperationCampaignTables(client);

        const { rows } = await client.query(
            `SELECT *
             FROM operations_campaigns
             WHERE placement_key = $1
               AND archived_at IS NULL
               AND start_at <= NOW()
               AND end_at > NOW()
               AND status IN ('active', 'draft')
             ORDER BY priority DESC, updated_at DESC
             LIMIT 30`,
            [placementKey]
        );

        const campaigns = rows.map((row) => normalizeOperationCampaignRow(row));
        const selected = campaigns.find((campaign) => {
            const previewWhitelist = asStringArray(campaign.trigger_config?.preview_whitelist);
            const previewEnabled = asBool(campaign.trigger_config?.preview_enabled, false);
            const isWhitelistedPreview = viewerKey && previewEnabled && previewWhitelist.includes(viewerKey);

            if (campaign.status === 'draft' && !isWhitelistedPreview) return false;
            if (campaign.status !== 'active' && campaign.status !== 'draft') return false;

            if (isWhitelistedPreview) return true;

            const ratio = Number(campaign.traffic_ratio || 0);
            if (ratio <= 0) return false;
            if (ratio >= 100) return true;
            if (!viewerKey) return false;
            return hashToBucket(`${viewerKey}:${campaign.id}`) < ratio;
        });

        return NextResponse.json({ success: true, campaign: selected || null });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[operations placement] GET failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}
