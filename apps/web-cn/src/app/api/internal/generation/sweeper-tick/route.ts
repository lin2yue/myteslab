import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { refundTaskCredits } from '@/app/api/wrap/generate/route';
import { verifyInternalRequest } from '@/lib/internal-auth';

export const maxDuration = 300;

const SWEEPER_ENABLED = (process.env.WRAP_GEN_SWEEPER_ENABLED ?? '1').trim() !== '0';
const WORKER_SECRET = (process.env.WRAP_WORKER_SECRET || '').trim();
const WORKER_HMAC_SECRET = (process.env.WRAP_WORKER_HMAC_SECRET || '').trim();
const WORKER_ALLOW_LEGACY_TOKEN = (process.env.WRAP_WORKER_ALLOW_LEGACY_TOKEN ?? '1').trim() !== '0';
const WORKER_HMAC_SKEW_SECONDS = Math.max(30, Number(process.env.WRAP_WORKER_HMAC_SKEW_SECONDS ?? 300));
const STALE_SECONDS = Math.max(60, Math.floor(Number(process.env.WRAP_TASK_STALE_MS ?? 10 * 60 * 1000) / 1000));
const DEFAULT_BATCH_SIZE = Math.max(1, Number(process.env.WRAP_SWEEPER_BATCH_SIZE ?? 50));
const MAX_BATCH_SIZE = Math.max(DEFAULT_BATCH_SIZE, Number(process.env.WRAP_SWEEPER_MAX_BATCH_SIZE ?? 200));
const STALE_REASON = 'Stale generation task auto-stopped by sweeper';

type StaleTaskRow = {
    id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function clampBatchSize(input: unknown): number {
    const value = Number(input);
    if (!Number.isFinite(value)) return DEFAULT_BATCH_SIZE;
    return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(value)));
}

async function claimStaleTasks(batchSize: number): Promise<string[]> {
    const client = await db().connect();
    try {
        await client.query('BEGIN');

        const staleStep = JSON.stringify([{ step: 'stale_auto_stopped', ts: new Date().toISOString(), reason: STALE_REASON }]);
        const { rows } = await client.query<StaleTaskRow>(
            `WITH candidates AS (
                SELECT id
                FROM generation_tasks
                WHERE status IN ('pending', 'processing')
                  AND COALESCE(updated_at, created_at) < NOW() - ($1::int * INTERVAL '1 second')
                  AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
                ORDER BY created_at ASC
                LIMIT $2
                FOR UPDATE SKIP LOCKED
            )
            UPDATE generation_tasks t
            SET status = 'failed',
                error_message = COALESCE(t.error_message, $3),
                steps = COALESCE(t.steps, '[]'::jsonb) || $4::jsonb,
                finished_at = NOW(),
                lease_owner = NULL,
                lease_expires_at = NULL,
                next_retry_at = NULL,
                updated_at = NOW()
            FROM candidates c
            WHERE t.id = c.id
            RETURNING t.id`,
            [STALE_SECONDS, batchSize, STALE_REASON, staleStep]
        );

        await client.query('COMMIT');
        return rows.map(row => row.id);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function POST(request: NextRequest) {
    if (!SWEEPER_ENABLED) {
        return NextResponse.json(
            { success: false, error: 'Sweeper disabled by WRAP_GEN_SWEEPER_ENABLED=0' },
            { status: 503 }
        );
    }

    if (!WORKER_SECRET && !WORKER_HMAC_SECRET) {
        return NextResponse.json(
            { success: false, error: 'Sweeper not configured: missing WRAP_WORKER_SECRET/WRAP_WORKER_HMAC_SECRET' },
            { status: 503 }
        );
    }

    const rawBody = await request.text();
    const authed = verifyInternalRequest(request, rawBody, {
        legacySecret: WORKER_SECRET,
        hmacSecret: WORKER_HMAC_SECRET,
        allowLegacyToken: WORKER_ALLOW_LEGACY_TOKEN,
        maxSkewSeconds: WORKER_HMAC_SKEW_SECONDS
    });
    if (!authed) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown = null;
    if (rawBody.trim()) {
        try {
            body = JSON.parse(rawBody);
        } catch {
            body = null;
        }
    }

    const batchSize = isRecord(body) ? clampBatchSize(body.batchSize) : DEFAULT_BATCH_SIZE;
    const startedAt = Date.now();
    const staleTaskIds = await claimStaleTasks(batchSize);
    if (staleTaskIds.length === 0) {
        return NextResponse.json({
            success: true,
            claimed: 0,
            refunded: 0,
            alreadyRefunded: 0,
            failedRefunds: 0,
            durationMs: Date.now() - startedAt
        });
    }

    let refunded = 0;
    let alreadyRefunded = 0;
    let failedRefunds = 0;

    for (const taskId of staleTaskIds) {
        try {
            const result = await refundTaskCredits(taskId, `Auto refund: ${STALE_REASON}`);
            if (!result.success) {
                failedRefunds += 1;
            } else if (result.alreadyRefunded) {
                alreadyRefunded += 1;
            } else {
                refunded += 1;
            }
        } catch (error) {
            failedRefunds += 1;
            console.error(`[SWEEPER] Refund failed for stale task ${taskId}:`, error);
        }
    }

    return NextResponse.json({
        success: true,
        claimed: staleTaskIds.length,
        refunded,
        alreadyRefunded,
        failedRefunds,
        durationMs: Date.now() - startedAt
    });
}

