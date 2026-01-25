#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

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

const sql = fs.readFileSync(join(__dirname, '../database/append_task_step_rpc.sql'), 'utf8');

async function installRPC() {
    console.log('🚀 Installing append_task_step RPC...');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    // If exec_sql is not available (standard for Supabase unless custom), use a different approach
    if (error) {
        console.log('⚠️ exec_sql failed or unavailable. Trying direct query if possible...');
        // In Supabase, there is no direct 'query' method in the JS client for arbitrary SQL.
        // We usually have to run it in the SQL Editor.
        // However, I can try to use the REST API if enabled, but that's also restricted.

        console.error('❌ Could not install RPC via JS client. Error:', error.message);
        console.log('\n💡 Please run the content of apps/web/database/append_task_step_rpc.sql in your Supabase SQL Editor.');
    } else {
        console.log('✅ RPC installed successfully.');
    }
}

installRPC().catch(console.error);
