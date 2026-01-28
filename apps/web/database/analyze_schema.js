
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Try to load env from .env.local if available (simplified loading)
// In a real scenario we rely on the shell or running environment, but here we can try to read it if we are running locally.
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2 && !line.startsWith('#')) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) {
                process.env[key] = val;
            }
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Environment Variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function analyzeSchema() {
    console.log('🚀 Starting Schema Analysis...\n')

    try {
        // 1. Get Tables and Columns
        // We select columns from information_schema
        // Note: Supabase JS client might not have permissions to query information_schema directly if RLS or permissions block it,
        // but Service Role Key should have access.

        // However, querying information_schema directly via postgrest might be tricky if not exposed.
        // A better way is to use RPC if available, but we might not have one.
        // Let's try to infer from a direct query if possible, or use the 'rpc' method if we can create a temporary function (we can't easily).
        // BUT, `setup.ts` used standard client. 
        // Let's try to query a known system table or just try to select from information_schema.columns. 
        // Supabase REST API exposes schema if configured, but information_schema is usually hidden.

        // ALTERNATIVE: Use the provided Schema Inspection SQL? 
        // No, I need to automating it.

        // If I cannot query information_schema via the client (likely), I might be limited.
        // Let's try a different approach:
        // Use the `pg` library if I can find the connection string? 
        // I don't have the connection string (postgres://...), only the HTTP URL.

        // Wait, `export_data.js` works by querying tables directly.
        // I can query tables directly, but I won't get types easily unless I check the returned data or errors.

        // BUT, I can try to use the REST API to describe the resource if Supabase supports it (OPTIONS request).
        // Or, maybe I can just try to run a raw SQL query if there is a helper for it? 
        // Supabase JS client doesn't support raw SQL unless via RPC.

        // Check `apps/web/database/` for any existing RPCs that execute SQL.
        // I see `apps/web/database/append_task_step_rpc.sql` etc.

        // If I can't query metadata, I will have to inspect by selecting one row from each table 
        // and checking the keys of the returned object. This gives me column names but not types.

        // Let's assume for now I cannot get full types without `information_schema` access.
        // However, looking at project context, the user has many SQL files. 
        // Maybe I can assume that if I can connect, I can check if tables exist.

        // Let's try to query `information_schema.columns` via the client. 
        // (Supabase usually exposes it if you add it to the exposed schemas, but default is public only).

        // Let's try to select from `wraps` limits 1 and see the keys.
        // And iterate over all tables mentioned in `schema.sql`.

        const tablesToCheck = [
            'wrap_models', 'wraps', 'wrap_model_map', 'profiles',
            'user_credits', 'generation_tasks', 'credit_ledger',
            'user_downloads', 'banners', 'audios'
        ];

        const schemaSnapshot = {};

        for (const table of tablesToCheck) {
            console.log(`Checking table: ${table}...`);
            const { data, error } = await supabase.from(table).select('*').limit(1);

            if (error) {
                console.error(`❌ Error accessing table ${table}:`, error.message);
                schemaSnapshot[table] = { status: 'error', error: error.message };
            } else {
                if (data.length > 0) {
                    const columns = Object.keys(data[0]);
                    console.log(`✅ Table ${table} exists. Columns found: ${columns.length}`);
                    schemaSnapshot[table] = { status: 'exists', columns: columns, example_row: data[0] };
                } else {
                    console.log(`✅ Table ${table} exists (empty).`);
                    // If empty, I can't guess columns easily without inserting (bad idea) or describing.
                    // But wait, if I select specific columns that don't exist, it errors.
                    // If I select '*', I get an empty list. 
                    // I can't retrieve column list from empty table via REST easily.
                    schemaSnapshot[table] = { status: 'exists_empty' };
                }
            }
        }

        console.log('\n --- Detailed Snapshot --- \n');
        console.log(JSON.stringify(schemaSnapshot, null, 2));

    } catch (error) {
        console.error('❌ Analysis failed:', error)
    }
}

analyzeSchema()
