import type { PoolClient } from 'pg';

export type CreditRewardCampaignStatus = 'draft' | 'active' | 'paused' | 'ended';

export interface CreditRewardCampaignMilestone {
    milestone_downloads: number;
    reward_credits: number;
}

export interface CreditRewardCampaign {
    id: string;
    name: string;
    status: CreditRewardCampaignStatus;
    start_at: string;
    end_at: string;
    milestones: CreditRewardCampaignMilestone[];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

const ALLOWED_STATUSES = new Set<CreditRewardCampaignStatus>(['draft', 'active', 'paused', 'ended']);

const DEFAULT_MILESTONES: CreditRewardCampaignMilestone[] = [
    { milestone_downloads: 10, reward_credits: 10 },
];

function normalizeDateValue(raw: unknown) {
    if (!raw) return new Date(0).toISOString();
    if (raw instanceof Date) return raw.toISOString();
    const parsed = new Date(String(raw));
    if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
    return parsed.toISOString();
}

export function normalizeCampaignStatus(raw: unknown, fallback: CreditRewardCampaignStatus = 'draft'): CreditRewardCampaignStatus {
    const value = String(raw || '').trim().toLowerCase();
    if (ALLOWED_STATUSES.has(value as CreditRewardCampaignStatus)) {
        return value as CreditRewardCampaignStatus;
    }
    return fallback;
}

export function normalizeCampaignMilestones(raw: unknown): CreditRewardCampaignMilestone[] {
    const milestoneMap = new Map<number, number>();
    if (Array.isArray(raw)) {
        for (const item of raw) {
            const milestone = Math.floor(Number((item as { milestone_downloads?: unknown })?.milestone_downloads));
            const rewardCredits = Math.floor(Number((item as { reward_credits?: unknown })?.reward_credits));
            if (!Number.isFinite(milestone) || milestone < 1) continue;
            if (!Number.isFinite(rewardCredits) || rewardCredits < 0) continue;
            milestoneMap.set(milestone, rewardCredits);
        }
    }

    if (milestoneMap.size === 0) {
        for (const row of DEFAULT_MILESTONES) {
            milestoneMap.set(row.milestone_downloads, row.reward_credits);
        }
    }

    return Array.from(milestoneMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([milestone_downloads, reward_credits]) => ({
            milestone_downloads,
            reward_credits,
        }));
}

export function normalizeCampaignRow(row: Record<string, unknown>): CreditRewardCampaign {
    return {
        id: String(row.id),
        name: String(row.name || ''),
        status: normalizeCampaignStatus(row.status, 'draft'),
        start_at: normalizeDateValue(row.start_at),
        end_at: normalizeDateValue(row.end_at),
        milestones: normalizeCampaignMilestones(row.milestones),
        created_by: row.created_by ? String(row.created_by) : null,
        created_at: normalizeDateValue(row.created_at),
        updated_at: normalizeDateValue(row.updated_at),
    };
}

export async function ensureCreditRewardCampaignTables(client: PoolClient) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS credit_reward_campaigns (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
            start_at TIMESTAMP WITH TIME ZONE NOT NULL,
            end_at TIMESTAMP WITH TIME ZONE NOT NULL,
            milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CHECK (end_at > start_at)
        );
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_credit_reward_campaigns_status_window
          ON credit_reward_campaigns(status, start_at, end_at);
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS credit_reward_campaign_grants (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            campaign_id UUID NOT NULL REFERENCES credit_reward_campaigns(id) ON DELETE CASCADE,
            wrap_id UUID NOT NULL REFERENCES wraps(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            milestone_downloads INTEGER NOT NULL CHECK (milestone_downloads >= 1),
            metric_value INTEGER NOT NULL CHECK (metric_value >= 0),
            reward_credits INTEGER NOT NULL CHECK (reward_credits >= 0),
            ledger_id UUID REFERENCES credit_ledger(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE (campaign_id, wrap_id, milestone_downloads)
        );
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_credit_reward_campaign_grants_campaign_created
          ON credit_reward_campaign_grants(campaign_id, created_at DESC);
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_credit_reward_campaign_grants_user_created
          ON credit_reward_campaign_grants(user_id, created_at DESC);
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_downloads_wrap_downloaded_at
          ON user_downloads(wrap_id, downloaded_at);
    `);
}
