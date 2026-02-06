import { dbQuery } from '@/lib/db';

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
    reason?: string
) {
    if (!taskId) {
        console.warn(`[TASK-LOG] ⚠️ No taskId provided for step: ${step}`);
        return;
    }

    try {
        const VERSION = "V1.1.0"; // 用于验证部署
        console.log(`[TASK-LOG] [${VERSION}] 📝 Task ${taskId}: ${step}${status ? ` -> ${status}` : ''}`);

        // Build step object
        const stepObj: any = { step, ts: new Date().toISOString() };
        if (reason) stepObj.reason = reason;

        await dbQuery(
            `UPDATE generation_tasks
             SET steps = COALESCE(steps, '[]'::jsonb) || $2::jsonb,
                 status = CASE WHEN $3::text IS NOT NULL THEN $3::generation_status ELSE status END,
                 updated_at = NOW(),
                 error_message = CASE WHEN $4::text IS NOT NULL THEN COALESCE(error_message, $4::text) ELSE error_message END
             WHERE id = $1`,
            [taskId, JSON.stringify([stepObj]), status || null, reason || null]
        );
    } catch (err) {
        console.error(`[TASK-LOG] ❌ Global error logging step ${step}:`, err);
    }
}
