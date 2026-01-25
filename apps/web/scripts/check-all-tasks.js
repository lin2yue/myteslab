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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTaskStatus() {
    console.log('📊 AI Task Status Statistics:\n');

    const { data, error } = await supabase
        .from('generation_tasks')
        .select('status');

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    const stats = data.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
    }, {});

    console.log(stats);

    const targetId = 'f05699c2-e5f1-4017-bf03-ff41e0f1203b';
    console.log(`\n🔍 Checking specific task: ${targetId}`);
    const { data: targetTask, error: targetErr } = await supabase
        .from('generation_tasks')
        .select('*')
        .eq('id', targetId)
        .single();

    if (targetErr) {
        console.error('❌ Error fetching target task:', targetErr.message);
    } else {
        console.log('Target Task Details:', JSON.stringify(targetTask, null, 2));
    }

    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    console.log(`\n🔍 Tasks created in the last 15 minutes:`);

    const { data: recentTasks, error: fetchErr } = await supabase
        .from('generation_tasks')
        .select(`
            *,
            profiles(display_name, email)
        `)
        .gte('created_at', fifteenMinsAgo)
        .order('created_at', { ascending: false });

    if (fetchErr) {
        console.error('❌ Error fetching recent tasks:', fetchErr);
    } else if (recentTasks.length === 0) {
        console.log('📭 No tasks found in the last 15 minutes.');
    } else {
        recentTasks.forEach(task => {
            console.log(`\n--- Task ID: ${task.id} ---`);
            console.log(`User: ${task.profiles?.display_name} (${task.profiles?.email})`);
            console.log(`Status: ${task.status}`);
            console.log(`Created At: ${task.created_at}`);
            console.log(`Steps:`, JSON.stringify(task.steps, null, 2));
            if (task.error_message) console.log(`Error: ${task.error_message}`);
        });
    }

    console.log('\n🔍 Absolute Latest 3 Tasks (any status):');
    const { data: latest } = await supabase
        .from('generation_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    console.log(JSON.stringify(latest, null, 2));
}

checkTaskStatus().catch(console.error);
