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
        console.log(`[TASK-LOG] 📝 Task ${taskId}: ${step}${status ? ` -> ${status}` : ''}`);
        await dbQuery(
            `UPDATE generation_tasks
             SET steps = COALESCE(steps, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('step', $2, 'ts', NOW(), 'reason', $3)),
                 status = COALESCE($4, status),
                 updated_at = NOW(),
                 error_message = CASE WHEN $3 IS NOT NULL THEN COALESCE(error_message, $3) ELSE error_message END
             WHERE id = $1`,
            [taskId, step, reason || null, status || null]
        );
    } catch (err) {
        console.error(`[TASK-LOG] ❌ Global error logging step ${step}:`, err);
    }
}
