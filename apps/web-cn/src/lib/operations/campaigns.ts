import type { PoolClient } from 'pg';

export type OperationCampaignStatus = 'draft' | 'active' | 'paused' | 'ended';

export interface FrequencyCapConfig {
    per_user_per_day: number;
}

export interface OperationCampaign {
    id: string;
    name: string;
    placement_key: string;
    status: OperationCampaignStatus;
    start_at: string;
    end_at: string;
    traffic_ratio: number;
    priority: number;
    frequency_cap: FrequencyCapConfig;
    audience: Record<string, unknown>;
    trigger_config: Record<string, unknown>;
    content: Record<string, unknown>;
    action_config: Record<string, unknown>;
    archived_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

const ALLOWED_STATUSES = new Set<OperationCampaignStatus>(['draft', 'active', 'paused', 'ended']);

const ALLOWED_PLACEMENTS = new Set([
    'home_modal',
    'home_banner',
    'wrap_list_slot',
    'generate_success_modal',
    'profile_task_card',
    'wrap_detail_cta',
]);

const DEFAULT_FREQUENCY_CAP: FrequencyCapConfig = {
    per_user_per_day: 1,
};

function toInteger(raw: unknown, fallback: number, min: number, max: number) {
    const value = Math.floor(Number(raw));
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, value));
}

function toObject(raw: unknown): Record<string, unknown> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw as Record<string, unknown>;
}

export function normalizeOperationCampaignStatus(raw: unknown, fallback: OperationCampaignStatus = 'draft'): OperationCampaignStatus {
    const value = String(raw || '').trim().toLowerCase();
    if (ALLOWED_STATUSES.has(value as OperationCampaignStatus)) {
        return value as OperationCampaignStatus;
    }
    return fallback;
}

export function normalizePlacementKey(raw: unknown, fallback = 'home_modal') {
    const value = String(raw || '').trim();
    if (ALLOWED_PLACEMENTS.has(value)) {
        return value;
    }
    return fallback;
}

export function normalizeFrequencyCap(raw: unknown): FrequencyCapConfig {
    const obj = toObject(raw);
    return {
        per_user_per_day: toInteger(obj.per_user_per_day, DEFAULT_FREQUENCY_CAP.per_user_per_day, 1, 100),
    };
}

export function normalizeOperationCampaignRow(row: Record<string, unknown>): OperationCampaign {
    return {
        id: String(row.id),
        name: String(row.name || ''),
        placement_key: normalizePlacementKey(row.placement_key),
        status: normalizeOperationCampaignStatus(row.status, 'draft'),
        start_at: row.start_at ? String(row.start_at) : new Date(0).toISOString(),
        end_at: row.end_at ? String(row.end_at) : new Date(0).toISOString(),
        traffic_ratio: toInteger(row.traffic_ratio, 100, 0, 100),
        priority: toInteger(row.priority, 0, -999, 999),
        frequency_cap: normalizeFrequencyCap(row.frequency_cap),
        audience: toObject(row.audience),
        trigger_config: toObject(row.trigger_config),
        content: toObject(row.content),
        action_config: toObject(row.action_config),
        archived_at: row.archived_at ? String(row.archived_at) : null,
        created_by: row.created_by ? String(row.created_by) : null,
        created_at: row.created_at ? String(row.created_at) : new Date(0).toISOString(),
        updated_at: row.updated_at ? String(row.updated_at) : new Date(0).toISOString(),
    };
}

export async function ensureOperationCampaignTables(client: PoolClient) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS operations_campaigns (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL,
            placement_key TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
            start_at TIMESTAMP WITH TIME ZONE NOT NULL,
            end_at TIMESTAMP WITH TIME ZONE NOT NULL,
            traffic_ratio INTEGER NOT NULL DEFAULT 100 CHECK (traffic_ratio >= 0 AND traffic_ratio <= 100),
            priority INTEGER NOT NULL DEFAULT 0,
            frequency_cap JSONB NOT NULL DEFAULT '{"per_user_per_day":1}'::jsonb,
            audience JSONB NOT NULL DEFAULT '{}'::jsonb,
            trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
            content JSONB NOT NULL DEFAULT '{}'::jsonb,
            action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
            archived_at TIMESTAMP WITH TIME ZONE NULL,
            created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CHECK (end_at > start_at)
        );
    `);

    await client.query(`
        ALTER TABLE operations_campaigns
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE NULL;
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_operations_campaigns_status_window
        ON operations_campaigns(status, start_at, end_at);
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_operations_campaigns_placement_priority
        ON operations_campaigns(placement_key, priority DESC, updated_at DESC);
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_operations_campaigns_archived
        ON operations_campaigns(archived_at);
    `);
}
