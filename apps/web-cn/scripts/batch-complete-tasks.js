#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function batchCompleteTasks() {
    console.log('🔄 Fetching all pending tasks...');

    const { data: pendingTasks, error: fetchError } = await supabase
        .from('generation_tasks')
        .select('id, steps')
        .eq('status', 'pending');

    if (fetchError) {
        console.error('❌ Error fetching tasks:', fetchError);
        return;
    }

    if (!pendingTasks || pendingTasks.length === 0) {
        console.log('✅ No pending tasks found.');
        return;
    }

    console.log(`🚀 Found ${pendingTasks.length} pending tasks. Starting update...`);

    let successCount = 0;
    for (const task of pendingTasks) {
        const newSteps = [
            ...(Array.isArray(task.steps) ? task.steps : []),
            { step: 'manually_completed_by_admin', ts: new Date().toISOString(), reason: 'Batch update requested by user' },
            { step: 'completed', ts: new Date().toISOString() }
        ];

        const { error: updateError } = await supabase
            .from('generation_tasks')
            .update({
                status: 'completed',
                steps: newSteps,
                updated_at: new Date().toISOString()
            })
            .eq('id', task.id);

        if (updateError) {
            console.error(`❌ Failed to update task ${task.id}:`, updateError);
        } else {
            successCount++;
        }
    }

    console.log(`\n🎉 Successfully updated ${successCount}/${pendingTasks.length} tasks to 'completed'.`);
}

batchCompleteTasks().catch(console.error);
