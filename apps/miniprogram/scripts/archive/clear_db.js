const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const loadEnvFileIfPresent = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return;

    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        if (!key) continue;
        if (Object.prototype.hasOwnProperty.call(process.env, key) && process.env[key]) continue;

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
};

loadEnvFileIfPresent(path.resolve(__dirname, '..', '.env'));
loadEnvFileIfPresent(path.resolve(__dirname, '..', '.env.local'));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDatabase() {
    console.log('🗑️  Starting Database Cleanup...');

    // Check if we can list
    const { count, error: countError } = await supabase
        .from('audios')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('❌ Failed to connect/read:', countError.message);
        return;
    }

    console.log(`📊 Found ${count} records to delete.`);

    // Delete All
    // Without a WHERE clause, delete() is blocked by default safety settings in client libs sometimes, 
    // but usually neq('id', 0) works as a "Delete All" trick.
    const { error } = await supabase
        .from('audios')
        .delete()
        .neq('id', 0); // Hack to match all positive IDs

    if (error) {
        console.error('❌ Delete Failed:', error.message);
        console.log('💡 HINT: You might need to run "TRUNCATE TABLE audios;" in the Supabase SQL Editor if RLS blocks wholesale deletion.');
    } else {
        console.log('✅ Database Cleared! Records deleted.');
    }
}

clearDatabase();
