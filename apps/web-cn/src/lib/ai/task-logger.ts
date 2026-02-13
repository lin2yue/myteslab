import { dbQuery } from '@/lib/db';
import dns from 'dns';

if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

/**
 * Robustly logs a step for an AI generation task.
 * Uses the Service Role (admin) client to bypass RLS and ensure updates succeed.
 * 
 * @param taskId The UUID of the task
 * @param step The step name
 * @param status Optional: Update the overall status of the task
 * @param reason Optional: Error message or reason for the step
 */
export async function logTaskStep(
    taskId: string | undefined,
    step: string,
    status?: string,
    reason?: string,
    metadata?: Record<string, unknown>
) {
    if (!taskId) {
        console.warn(`[TASK-LOG] ⚠️ No taskId provided for step: ${step}`);
        return;
    }

    try {
        const VERSION = "V1.1.0"; // 用于验证部署
        console.log(`[TASK-LOG] [${VERSION}] 📝 Task ${taskId}: ${step}${status ? ` -> ${status}` : ''}`);

        // Build step object
        const stepObj: Record<string, unknown> = { step, ts: new Date().toISOString() };
        if (reason) stepObj.reason = reason;
        if (metadata && typeof metadata === 'object') {
            Object.assign(stepObj, metadata);
        }

        // 1. Update the database
        await dbQuery(
            `UPDATE generation_tasks
             SET steps = COALESCE(steps, '[]'::jsonb) || $2::jsonb,
                 status = CASE WHEN $3::text IS NOT NULL THEN $3::generation_status ELSE status END,
                 updated_at = NOW(),
                 error_message = CASE WHEN $4::text IS NOT NULL THEN COALESCE(error_message, $4::text) ELSE error_message END
             WHERE id = $1`,
            [taskId, JSON.stringify([stepObj]), status || null, reason || null]
        );

        // 2. Notify for SSE real-time updates (Non-blocking or separate)
        await dbQuery(`SELECT pg_notify('generation_task_updates', $1)`, [taskId]);
    } catch (err) {
        console.error(`[TASK-LOG] ❌ Global error logging step ${step}:`, err);
    }
}
