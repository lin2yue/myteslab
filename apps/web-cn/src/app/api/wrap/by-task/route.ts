import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';

const RETRY_AFTER_SECONDS = Number(process.env.WRAP_TASK_RETRY_AFTER_SECONDS ?? 5);
const THROTTLE_WINDOW_MS = Number(process.env.WRAP_TASK_THROTTLE_WINDOW_MS ?? 3000);
const userThrottleMap = new Map<string, number>();
const cacheMap = new Map<string, { expiresAt: number; payload: any; status: number }>();
const CACHE_TTL_MS = Number(process.env.WRAP_TASK_CACHE_TTL_MS ?? 3000);

type TaskStep = { step?: string; ts?: string };

function normalizeTaskSteps(raw: unknown): TaskStep[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(item => {
            if (!item || typeof item !== 'object') return null;
            const step = typeof (item as any).step === 'string' ? (item as any).step : '';
            const ts = typeof (item as any).ts === 'string' ? (item as any).ts : '';
            if (!step) return null;
            return { step, ts };
        })
        .filter(Boolean) as TaskStep[];
}

function getRetryProgressFromSteps(raw: unknown, status: string) {
    const steps = normalizeTaskSteps(raw);
    const lastRetryStep = [...steps].reverse().find(step => step.step === 'prompt_retry_optimized');
    if (!lastRetryStep) {
        return {
            retrying: false,
            retryStartedAt: null as string | null
        };
    }

    const hasRetryEnded = steps.some(step =>
        step.step === 'prompt_retry_success'
        || step.step === 'prompt_retry_failed'
        || step.step === 'prompt_retry_skipped'
    );

    const retrying = (status === 'pending' || status === 'processing') && !hasRetryEnded;
    return {
        retrying,
        retryStartedAt: retrying ? (lastRetryStep.ts || null) : null
    };
}

function extractSavedUrlFromSteps(steps: unknown): string | null {
    if (!Array.isArray(steps)) return null;
    for (let i = steps.length - 1; i >= 0; i -= 1) {
        const step = steps[i] as any;
        if (typeof step?.savedUrl === 'string' && step.savedUrl) {
            return step.savedUrl;
        }
        if (typeof step?.reason === 'string' && step.reason.startsWith('http')) {
            return step.reason;
        }
    }
    return null;
}

function jsonWithRetry(body: any, status: number) {
    return NextResponse.json(body, {
        status,
        headers: {
            'Retry-After': String(RETRY_AFTER_SECONDS),
        }
    });
}

/**
 * POST /api/wrap/by-task
 * Returns wrap by generation task id for the current user
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { taskId } = await request.json();
        if (!taskId) {
            return NextResponse.json({ success: false, error: 'Missing taskId' }, { status: 400 });
        }

        const now = Date.now();
        const lastRequest = userThrottleMap.get(user.id);
        if (lastRequest && now - lastRequest < THROTTLE_WINDOW_MS) {
            return jsonWithRetry({
                success: false,
                error: 'Too many requests',
                retryAfter: RETRY_AFTER_SECONDS
            }, 429);
        }
        userThrottleMap.set(user.id, now);

        const cacheKey = `${user.id}:${taskId}`;
        const cached = cacheMap.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return NextResponse.json(cached.payload, {
                status: cached.status,
                headers: {
                    'Retry-After': String(RETRY_AFTER_SECONDS),
                }
            });
        }

        const { rows: taskRows } = await dbQuery(
            `SELECT status, error_message, wrap_id, steps
             FROM generation_tasks
             WHERE id = $1 AND user_id = $2
             LIMIT 1`,
            [taskId, user.id]
        );
        const task = taskRows[0];

        if (!task) {
            const payload = { success: false, error: 'Task not found' };
            cacheMap.set(cacheKey, { payload, status: 404, expiresAt: now + CACHE_TTL_MS });
            return NextResponse.json(payload, { status: 404 });
        }

        if (task.wrap_id) {
            const { rows: wrapRows } = await dbQuery(
                `SELECT id, preview_url, texture_url, generation_task_id
                 FROM wraps
                 WHERE id = $1 AND user_id = $2
                 LIMIT 1`,
                [task.wrap_id, user.id]
            );
            const wrap = wrapRows[0];
            if (wrap) {
                const payload = { success: true, wrap };
                cacheMap.set(cacheKey, { payload, status: 200, expiresAt: now + CACHE_TTL_MS });
                return NextResponse.json(payload);
            }
        }

        const { rows: wrapRows } = await dbQuery(
            `SELECT id, preview_url, texture_url, generation_task_id
             FROM wraps
             WHERE generation_task_id = $1 AND user_id = $2
             LIMIT 1`,
            [taskId, user.id]
        );
        const wrap = wrapRows[0];

        if (!wrap) {
            if (task.status === 'failed' || task.status === 'failed_refunded') {
                const payload = {
                    success: true,
                    status: 'failed',
                    taskStatus: task.status,
                    refunded: task.status === 'failed_refunded',
                    error: task.error_message || 'Generation failed',
                    retryAfter: RETRY_AFTER_SECONDS
                };
                cacheMap.set(cacheKey, { payload, status: 200, expiresAt: now + CACHE_TTL_MS });
                return jsonWithRetry(payload, 200);
            }

            if (task.status === 'completed') {
                const savedUrl = extractSavedUrlFromSteps(task.steps);
                if (savedUrl) {
                    const payload = {
                        success: true,
                        wrap: {
                            id: taskId,
                            preview_url: savedUrl,
                            texture_url: savedUrl,
                            generation_task_id: taskId
                        }
                    };
                    cacheMap.set(cacheKey, { payload, status: 200, expiresAt: now + CACHE_TTL_MS });
                    return NextResponse.json(payload);
                }
                const payload = {
                    success: true,
                    status: 'completed_missing',
                    error: 'Task completed but result not found',
                    retryAfter: RETRY_AFTER_SECONDS
                };
                cacheMap.set(cacheKey, { payload, status: 200, expiresAt: now + CACHE_TTL_MS });
                return jsonWithRetry(payload, 200);
            }

            const payload = {
                success: true,
                status: task.status === 'processing' ? 'processing' : 'pending',
                ...getRetryProgressFromSteps(task.steps, task.status),
                retryAfter: RETRY_AFTER_SECONDS
            };
            cacheMap.set(cacheKey, { payload, status: 202, expiresAt: now + CACHE_TTL_MS });
            return jsonWithRetry(payload, 202);
        }

        const payload = { success: true, wrap };
        cacheMap.set(cacheKey, { payload, status: 200, expiresAt: now + CACHE_TTL_MS });
        return NextResponse.json(payload);
    } catch (error: any) {
        console.error('[Wrap-By-Task] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
