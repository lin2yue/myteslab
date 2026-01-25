import { createAdminClient } from '@/utils/supabase/admin';

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
    supabaseClient?: any
) {
    if (!taskId) {
        console.warn(`[TASK-LOG] ⚠️ No taskId provided for step: ${step}`);
        return;
    }

    let client = supabaseClient;
    if (!client) {
        try {
            client = createAdminClient();
        } catch (e) {
            console.warn('[TASK-LOG] ⚠️ Failed to create admin client, logging will effectively be skipped unless rpc works via console log:', e);
            // If we can't create a client, we can't log to DB.
            return;
        }
    }

    // Safety check just in case
    if (!client) return;

    try {
        console.log(`[TASK-LOG] 📝 Task ${taskId}: ${step}${status ? ` -> ${status}` : ''}`);

        const { error } = await client.rpc('append_task_step', {
            p_task_id: taskId,
            p_status: status || null,
            p_step: step,
            p_reason: reason || null
        });

        if (error) {
            console.error(`[TASK-LOG] ❌ RPC Error logging step ${step}:`, error);
        }
    } catch (err) {
        console.error(`[TASK-LOG] ❌ Global error logging step ${step}:`, err);
    }
}
