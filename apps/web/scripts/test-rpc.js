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

async function testRPC() {
    const targetId = 'f05699c2-e5f1-4017-bf03-ff41e0f1203b';
    console.log(`🧪 Testing RPC for task: ${targetId}`);

    console.log('--- Attempt 1: Add step to processing ---');
    const { data: d1, error: e1 } = await supabase.rpc('append_task_step', {
        p_task_id: targetId,
        p_status: 'processing',
        p_step: 'rpc_test_start'
    });

    if (e1) {
        console.error('❌ Error 1:', e1.message);
    } else {
        console.log('✅ Success 1. Steps:', JSON.stringify(d1, null, 2));
    }

    console.log('\n--- Attempt 2: Add step without status change ---');
    const { data: d2, error: e2 } = await supabase.rpc('append_task_step', {
        p_task_id: targetId,
        p_step: 'rpc_test_middle'
    });

    if (e2) {
        console.error('❌ Error 2:', e2.message);
    } else {
        console.log('✅ Success 2. Steps:', JSON.stringify(d2, null, 2));
    }

    console.log('\n--- Attempt 3: Change to completed ---');
    const { data: d3, error: e3 } = await supabase.rpc('append_task_step', {
        p_task_id: targetId,
        p_status: 'completed',
        p_step: 'rpc_test_end'
    });

    if (e3) {
        console.error('❌ Error 3:', e3.message);
    } else {
        console.log('✅ Success 3. Steps:', JSON.stringify(d3, null, 2));
    }
}

testRPC().catch(console.error);
