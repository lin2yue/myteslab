import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const RETRY_AFTER_SECONDS = Number(process.env.WRAP_TASK_RETRY_AFTER_SECONDS ?? 5);
const THROTTLE_WINDOW_MS = Number(process.env.WRAP_TASK_THROTTLE_WINDOW_MS ?? 3000);
const userThrottleMap = new Map<string, number>();
const cacheMap = new Map<string, { expiresAt: number; payload: any; status: number }>();
const CACHE_TTL_MS = Number(process.env.WRAP_TASK_CACHE_TTL_MS ?? 3000);

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
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
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

        const { data: task } = await supabase
            .from('generation_tasks')
            .select('status, error_message, wrap_id')
            .eq('id', taskId)
            .eq('user_id', user.id)
            .single();

        if (!task) {
            const payload = { success: false, error: 'Task not found' };
            cacheMap.set(cacheKey, { payload, status: 404, expiresAt: now + CACHE_TTL_MS });
            return NextResponse.json(payload, { status: 404 });
        }

        if (task.wrap_id) {
            const { data: wrap, error } = await supabase
                .from('wraps')
                .select('id, preview_url, texture_url, generation_task_id')
                .eq('id', task.wrap_id)
                .eq('user_id', user.id)
                .single();

            if (!error && wrap) {
                const payload = { success: true, wrap };
                cacheMap.set(cacheKey, { payload, status: 200, expiresAt: now + CACHE_TTL_MS });
                return NextResponse.json(payload);
            }
        }

        const { data: wrap, error } = await supabase
            .from('wraps')
            .select('id, preview_url, texture_url, generation_task_id')
            .eq('generation_task_id', taskId)
            .eq('user_id', user.id)
            .single();

        if (error || !wrap) {
            if (task.status === 'failed' || task.status === 'failed_refunded') {
                const payload = {
                    success: true,
                    status: 'failed',
                    error: task.error_message || 'Generation failed',
                    retryAfter: RETRY_AFTER_SECONDS
                };
                cacheMap.set(cacheKey, { payload, status: 200, expiresAt: now + CACHE_TTL_MS });
                return jsonWithRetry(payload, 200);
            }

            if (task.status === 'completed') {
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
                status: 'pending',
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
