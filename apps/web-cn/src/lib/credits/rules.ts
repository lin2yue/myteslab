import type { PoolClient } from 'pg';
import { db } from '@/lib/db';

export interface CreditRulesSnapshot {
    registration_enabled: boolean;
    registration_credits: number;
    updated_at: string | null;
}

const DEFAULT_RULES: Omit<CreditRulesSnapshot, 'updated_at'> = {
    registration_enabled: true,
    registration_credits: 30,
};

function normalizeRules(row: Record<string, unknown> | undefined): CreditRulesSnapshot {
    return {
        registration_enabled: Boolean(row?.registration_enabled),
        registration_credits: Math.max(0, Number(row?.registration_credits || 0)),
        updated_at: row?.updated_at ? String(row.updated_at) : null,
    };
}

export async function ensureCreditRuleTables(client: PoolClient) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS credit_reward_rules (
            id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            registration_credits INTEGER NOT NULL DEFAULT 30 CHECK (registration_credits >= 0),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
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
                registration_credits
            )
            VALUES (1, $1, $2)
            ON CONFLICT (id) DO NOTHING`,
            [
                DEFAULT_RULES.registration_enabled,
                DEFAULT_RULES.registration_credits,
            ]
        );

        const { rows } = await client.query(`SELECT id, registration_enabled, registration_credits, updated_at FROM credit_reward_rules WHERE id = 1 LIMIT 1`);
        return normalizeRules(rows[0] || DEFAULT_RULES);
    } finally {
        client.release();
    }
}

