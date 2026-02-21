import type { PoolClient } from 'pg';
import { db } from '@/lib/db';

export interface CreditRulesSnapshot {
    registration_enabled: boolean;
    registration_credits: number;
    download_reward_enabled: boolean;
    download_threshold: number;
    download_reward_credits: number;
    updated_at: string | null;
}

const DEFAULT_RULES: Omit<CreditRulesSnapshot, 'updated_at'> = {
    registration_enabled: true,
    registration_credits: 30,
    download_reward_enabled: false,
    download_threshold: 100,
    download_reward_credits: 10,
};

function normalizeRules(row: Record<string, unknown> | undefined): CreditRulesSnapshot {
    return {
        registration_enabled: Boolean(row?.registration_enabled),
        registration_credits: Math.max(0, Number(row?.registration_credits || 0)),
        download_reward_enabled: Boolean(row?.download_reward_enabled),
        download_threshold: Math.max(1, Number(row?.download_threshold || 1)),
        download_reward_credits: Math.max(0, Number(row?.download_reward_credits || 0)),
        updated_at: row?.updated_at ? String(row.updated_at) : null,
    };
}

export async function ensureCreditRuleTables(client: PoolClient) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS credit_reward_rules (
            id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            registration_credits INTEGER NOT NULL DEFAULT 30 CHECK (registration_credits >= 0),
            download_reward_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            download_threshold INTEGER NOT NULL DEFAULT 100 CHECK (download_threshold >= 1),
            download_reward_credits INTEGER NOT NULL DEFAULT 10 CHECK (download_reward_credits >= 0),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS wrap_download_reward_grants (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            wrap_id UUID NOT NULL REFERENCES wraps(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            milestone_downloads INTEGER NOT NULL CHECK (milestone_downloads >= 1),
            reward_credits INTEGER NOT NULL CHECK (reward_credits >= 0),
            ledger_id UUID REFERENCES credit_ledger(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE (wrap_id, milestone_downloads)
        );
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_wrap_download_reward_grants_user_created
          ON wrap_download_reward_grants(user_id, created_at DESC);
    `);
}

export async function getCreditRulesSnapshot(): Promise<CreditRulesSnapshot> {
    const client = await db().connect();
    try {
        await ensureCreditRuleTables(client);

        await client.query(
            `INSERT INTO credit_reward_rules (
                id,
                registration_enabled,
                registration_credits,
                download_reward_enabled,
                download_threshold,
                download_reward_credits
            )
            VALUES (1, $1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING`,
            [
                DEFAULT_RULES.registration_enabled,
                DEFAULT_RULES.registration_credits,
                DEFAULT_RULES.download_reward_enabled,
                DEFAULT_RULES.download_threshold,
                DEFAULT_RULES.download_reward_credits
            ]
        );

        const { rows } = await client.query(`SELECT * FROM credit_reward_rules WHERE id = 1 LIMIT 1`);
        return normalizeRules(rows[0] || DEFAULT_RULES);
    } finally {
        client.release();
    }
}
