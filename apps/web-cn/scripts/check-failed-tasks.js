#!/usr/bin/env node

/**
 * 调试脚本：查询最近失败的 AI 生成任务
 * 用法：node check-failed-tasks.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkFailedTasks() {
    console.log('🔍 Checking failed AI generation tasks...\n');

    // 1. 查询最近失败的任务
    const { data: failedTasks, error } = await supabase
        .from('generation_tasks')
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('❌ Error querying failed tasks:', error);
        return;
    }

    if (!failedTasks || failedTasks.length === 0) {
        console.log('✅ No failed tasks found!');
        return;
    }

    console.log(`📊 Found ${failedTasks.length} failed tasks:\n`);

    failedTasks.forEach((task, index) => {
        console.log(`${index + 1}. Task ID: ${task.id}`);
        console.log(`   Prompt: ${task.prompt.substring(0, 50)}...`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Credits Spent: ${task.credits_spent}`);
        console.log(`   Error: ${task.error_message || 'No error message'}`);
        console.log(`   Created: ${task.created_at}`);
        console.log(`   Updated: ${task.updated_at}`);
        console.log('');
    });

    // 2. 统计错误类型
    const errorCounts = {};
    failedTasks.forEach(task => {
        const errorMsg = task.error_message || 'Unknown error';
        errorCounts[errorMsg] = (errorCounts[errorMsg] || 0) + 1;
    });

    console.log('\n📈 Error type statistics:');
    Object.entries(errorCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([error, count]) => {
            console.log(`   ${count}x: ${error}`);
        });
}

checkFailedTasks().catch(console.error);
