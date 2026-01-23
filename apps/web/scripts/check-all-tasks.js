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

    console.log('\n🔍 Recent tasks (last 5):');
    const { data: recent } = await supabase
        .from('generation_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log(JSON.stringify(recent, null, 2));
}

checkTaskStatus().catch(console.error);
