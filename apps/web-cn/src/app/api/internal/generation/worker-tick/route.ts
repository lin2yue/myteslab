import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { processGenerationTask, refundTaskCredits } from '@/app/api/wrap/generate/route';
import { verifyInternalRequest } from '@/lib/internal-auth';

export const maxDuration = 300;

const WORKER_ENABLED = (process.env.WRAP_GEN_V2_WORKER ?? '1').trim() !== '0';
const WORKER_SECRET = (process.env.WRAP_WORKER_SECRET || '').trim();
const WORKER_HMAC_SECRET = (process.env.WRAP_WORKER_HMAC_SECRET || '').trim();
const WORKER_ALLOW_LEGACY_TOKEN = (process.env.WRAP_WORKER_ALLOW_LEGACY_TOKEN ?? '1').trim() !== '0';
const WORKER_HMAC_SKEW_SECONDS = Math.max(30, Number(process.env.WRAP_WORKER_HMAC_SKEW_SECONDS ?? 300));
const DEFAULT_BATCH_SIZE = Math.max(1, Number(process.env.WRAP_WORKER_BATCH_SIZE ?? 2));
const MAX_BATCH_SIZE = Math.max(DEFAULT_BATCH_SIZE, Number(process.env.WRAP_WORKER_MAX_BATCH_SIZE ?? 5));
const LEASE_SECONDS = Math.max(30, Number(process.env.WRAP_WORKER_LEASE_SECONDS ?? 240));
const DEFAULT_ORIGIN = (
    process.env.WRAP_APP_ORIGIN
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || 'https://tewan.club'
).replace(/\/+$/, '');

type ClaimedTaskRow = {
    id: string;
    user_id: string;
    prompt: string;
    steps: unknown;
};

type QueuedTaskPayload = {
    modelSlug: string;
    modelName: string;
    prompt: string;
    referenceImages: string[];
    origin: string;
};

function clampBatchSize(input: unknown): number {
    const value = Number(input);
    if (!Number.isFinite(value)) return DEFAULT_BATCH_SIZE;
    return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeOrigin(value: string): string {
    const raw = value.trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        return raw.replace(/\/+$/, '');
    }
    return DEFAULT_ORIGIN;
}

function extractQueuedPayload(steps: unknown, fallbackPrompt: string): QueuedTaskPayload | null {
    if (!Array.isArray(steps)) return null;

    for (let index = steps.length - 1; index >= 0; index -= 1) {
        const step = steps[index];
        if (!isRecord(step)) continue;
        if (step.step !== 'queued_for_worker') continue;

        const modelSlug = typeof step.modelSlug === 'string' ? step.modelSlug.trim() : '';
        const modelName = typeof step.modelName === 'string' ? step.modelName.trim() : '';
        const queuedPrompt = typeof step.prompt === 'string' ? step.prompt.trim() : '';
        const prompt = queuedPrompt || fallbackPrompt;

        const referenceImages = Array.isArray(step.referenceImages)
            ? step.referenceImages
                .filter((item): item is string => typeof item === 'string')
                .map(item => item.trim())
                .filter(Boolean)
            : [];

        const origin = typeof step.origin === 'string'
            ? normalizeOrigin(step.origin)
            : DEFAULT_ORIGIN;

        if (!modelSlug || !modelName || !prompt) {
            return null;
        }

        return {
            modelSlug,
            modelName,
            prompt,
            referenceImages,
            origin
        };
    }

    return null;
}

async function claimPendingTasks(batchSize: number, workerId: string): Promise<ClaimedTaskRow[]> {
    const client = await db().connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query<ClaimedTaskRow>(
            `WITH candidates AS (
                SELECT id
                FROM generation_tasks
                WHERE status IN ('pending', 'processing')
                  AND (
                    (status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
                    OR (status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < NOW())
                  )
                  AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
                  AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(COALESCE(steps, '[]'::jsonb)) AS step
                    WHERE step->>'step' = 'queued_for_worker'
                  )
                ORDER BY created_at ASC
                LIMIT $1
                FOR UPDATE SKIP LOCKED
            )
            UPDATE generation_tasks t
            SET status = 'processing',
                attempts = t.attempts + 1,
                started_at = COALESCE(t.started_at, NOW()),
                lease_owner = $2,
                lease_expires_at = NOW() + ($3::int * INTERVAL '1 second'),
                next_retry_at = NULL,
                updated_at = NOW()
            FROM candidates c
            WHERE t.id = c.id
            RETURNING t.id, t.user_id, t.prompt, t.steps`,
            [batchSize, workerId, LEASE_SECONDS]
        );

        await client.query('COMMIT');
        return rows;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function failAndRefundTask(taskId: string, reason: string) {
    try {
        await refundTaskCredits(taskId, reason);
    } catch (error) {
        console.error(`[WORKER] Refund failed for task ${taskId}:`, error);
    }
}

export async function POST(request: NextRequest) {
    if (!WORKER_ENABLED) {
        return NextResponse.json(
            { success: false, error: 'Worker disabled by WRAP_GEN_V2_WORKER=0' },
            { status: 503 }
        );
    }

    if (!WORKER_SECRET && !WORKER_HMAC_SECRET) {
        return NextResponse.json(
            { success: false, error: 'Worker not configured: missing WRAP_WORKER_SECRET/WRAP_WORKER_HMAC_SECRET' },
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
    const workerId = `wrap-worker-${crypto.randomUUID().slice(0, 8)}`;
    const startedAt = Date.now();

    const claimedTasks = await claimPendingTasks(batchSize, workerId);
    if (claimedTasks.length === 0) {
        return NextResponse.json({
            success: true,
            workerId,
            claimed: 0,
            processed: 0,
            failed: 0,
            skipped: 0,
            durationMs: Date.now() - startedAt
        });
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    const results = await Promise.allSettled(claimedTasks.map(async (task) => {
        const payload = extractQueuedPayload(task.steps, task.prompt);
        if (!payload) {
            await failAndRefundTask(task.id, 'Worker payload missing: queued task metadata not found');
            return 'skipped';
        }

        try {
            await processGenerationTask({
                taskId: task.id,
                userId: task.user_id,
                modelSlug: payload.modelSlug,
                modelName: payload.modelName,
                prompt: payload.prompt,
                referenceImages: payload.referenceImages,
                origin: payload.origin
            });
            return 'processed';
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            await failAndRefundTask(task.id, `Worker processing exception: ${reason}`);
            return 'failed';
        }
    }));

    results.forEach((res) => {
        if (res.status === 'fulfilled') {
            const type = res.value;
            if (type === 'processed') processed += 1;
            else if (type === 'failed') failed += 1;
            else if (type === 'skipped') skipped += 1;
        } else {
            failed += 1;
        }
    });

    return NextResponse.json({
        success: true,
        workerId,
        claimed: claimedTasks.length,
        processed,
        failed,
        skipped,
        durationMs: Date.now() - startedAt
    });
}
