import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';
import { ensureCreditRuleTables, getCreditRulesSnapshot } from '@/lib/credits/rules';

function toNonNegativeInt(input: unknown, fallback: number) {
    const value = Number(input);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.floor(value));
}

export async function GET() {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const rules = await getCreditRulesSnapshot();
        return NextResponse.json({ success: true, rules });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal error';
        console.error('[admin credits rules] GET failed:', err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
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
    };

    const client = await db().connect();
    try {
        await ensureCreditRuleTables(client);
        await client.query(
            `INSERT INTO credit_reward_rules (
                id,
                registration_enabled,
                registration_credits,
                updated_at
            )
            VALUES (1, $1, $2, NOW())
            ON CONFLICT (id)
            DO UPDATE SET
                registration_enabled = EXCLUDED.registration_enabled,
                registration_credits = EXCLUDED.registration_credits,
                updated_at = NOW()`,
            [
                payload.registration_enabled,
                payload.registration_credits,
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

