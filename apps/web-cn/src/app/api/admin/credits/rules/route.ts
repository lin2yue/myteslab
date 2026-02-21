import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';
import { ensureCreditRuleTables, getCreditRulesSnapshot } from '@/lib/credits/rules';

function toNonNegativeInt(input: unknown, fallback: number) {
    const value = Number(input);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.floor(value));
}

function toAtLeastOneInt(input: unknown, fallback: number) {
    const value = Number(input);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(1, Math.floor(value));
}

export async function GET() {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const client = await db().connect();
    try {
        await ensureCreditRuleTables(client);
        const rules = await getCreditRulesSnapshot();
        const { rows } = await client.query(
            `SELECT
                g.id,
                g.wrap_id,
                g.user_id,
                g.milestone_downloads,
                g.reward_credits,
                g.created_at,
                g.ledger_id,
                w.name AS wrap_name,
                w.prompt AS wrap_prompt,
                p.display_name AS owner_display_name,
                p.email AS owner_email
             FROM wrap_download_reward_grants g
             LEFT JOIN wraps w ON w.id = g.wrap_id
             LEFT JOIN profiles p ON p.id = g.user_id
             ORDER BY g.created_at DESC
             LIMIT 100`
        );

        return NextResponse.json({
            success: true,
            rules,
            rewardRecords: rows
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin credits rules] GET failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}

export async function PUT(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const payload = {
        registration_enabled: Boolean(body?.registration_enabled),
        registration_credits: toNonNegativeInt(body?.registration_credits, 30),
        download_reward_enabled: Boolean(body?.download_reward_enabled),
        download_threshold: toAtLeastOneInt(body?.download_threshold, 100),
        download_reward_credits: toNonNegativeInt(body?.download_reward_credits, 10),
    };

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
                download_reward_credits,
                updated_at
            )
            VALUES (1, $1, $2, $3, $4, $5, NOW())
            ON CONFLICT (id)
            DO UPDATE SET
                registration_enabled = EXCLUDED.registration_enabled,
                registration_credits = EXCLUDED.registration_credits,
                download_reward_enabled = EXCLUDED.download_reward_enabled,
                download_threshold = EXCLUDED.download_threshold,
                download_reward_credits = EXCLUDED.download_reward_credits,
                updated_at = NOW()`,
            [
                payload.registration_enabled,
                payload.registration_credits,
                payload.download_reward_enabled,
                payload.download_threshold,
                payload.download_reward_credits
            ]
        );

        const rules = await getCreditRulesSnapshot();
        return NextResponse.json({ success: true, rules });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin credits rules] PUT failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
        client.release();
    }
}
