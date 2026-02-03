const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const envPath = process.argv[2] || '.env.local';
console.log(`Using environment file: ${envPath}`);
require('dotenv').config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('--- Database Schema Check ---');

    const tablesToCheck = [
        'wrap_models',
        'profiles',
        'wraps',
        'wrap_model_map',
        'user_credits',
        'generation_tasks',
        'credit_ledger',
        'user_downloads',
        'banners',
        'audios'
    ];

    for (const table of tablesToCheck) {
        console.log(`\nChecking table: ${table}`);

        // We can use a trick to get column names by selecting 0 rows
        const { data, error } = await supabase.from(table).select('*').limit(0);

        if (error) {
            if (error.code === '42P01') {
                console.log(`❌ Table "${table}" does not exist!`);
            } else {
                console.log(`❌ Error checking table "${table}":`, error.message);
            }
            continue;
        }

        // If data is returned (even empty), we can check columns if your version of the driver supports it
        // Or we can try to select one row and see the keys
        const { data: sampleData, error: sampleError } = await supabase.from(table).select('*').limit(1);

        if (sampleError) {
            console.log(`❌ Could not fetch columns for "${table}":`, sampleError.message);
        } else if (sampleData && sampleData.length > 0) {
            const columns = Object.keys(sampleData[0]);
            console.log(`✅ Table exists. Columns: ${columns.join(', ')}`);
            console.log(`Total records: (checking...)`);
            const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
            console.log(`Count: ${count}`);
        } else {
            console.log(`✅ Table exists but it is empty. (Cannot verify columns easily via JS client)`);
            // Fallback: try to select specific columns from schema.sql to see if they fail
        }
    }

    // Check Enums if possible (via a sample insert/select or if you have a custom RPC)
    console.log('\n--- Checking Task Status Enum ---');
    const { data: taskData, error: taskError } = await supabase.from('generation_tasks').select('status').limit(1);
    if (!taskError) {
        console.log('✅ generation_status enum seems functional.');
    }

    console.log('\n--- Comparison with schema.sql ---');
    const schemaPath = path.join(__dirname, 'database/schema.sql');
    if (fs.existsSync(schemaPath)) {
        console.log('Found schema.sql at', schemaPath);
    } else {
        console.log('Warning: schema.sql not found at expected path.');
    }
}

checkSchema();
