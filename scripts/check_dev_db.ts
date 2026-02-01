
import fs from 'fs';
import path from 'path';

// Manual env parsing
const envPath = path.resolve(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envConfig: Record<string, string> = {};

envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
        envConfig[key] = value;
    }
});

const supabaseUrl = envConfig['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envConfig['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Anon Key in .env.local');
    process.exit(1);
}

console.log(`Connecting to Supabase: ${supabaseUrl}`);

async function check() {
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
    };

    // Check wrap_models
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/wrap_models?select=id,slug,name`, { headers });
        if (!res.ok) throw new Error(`Fetch failed for models: ${res.status} ${res.statusText} - ${await res.text()}`);
        const models = await res.json();
        console.log(`✅ Found ${models.length} models in 'wrap_models' table.`);
        if (models.length > 0) {
            console.log('Sample models:', models.slice(0, 3).map((m: any) => m.slug).join(', '));
        } else {
            console.warn('⚠️ WARNING: No models found! The catalog is empty.');
        }
    } catch (err) {
        console.error('Error fetching wrap_models:', err);
    }

    // Check wraps
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/wraps?select=id,name,is_public,category,user_id&limit=10`, { headers });
        if (!res.ok) throw new Error(`Fetch failed for wraps: ${res.status} ${res.statusText} - ${await res.text()}`);
        const wraps = await res.json();
        console.log(`✅ Found ${wraps.length} recent wraps (limit 10 checked):`);
        // console.log(JSON.stringify(wraps, null, 2));

        // Count total wraps
        const countRes = await fetch(`${supabaseUrl}/rest/v1/wraps?select=count`, { headers, method: 'HEAD' });
        const range = countRes.headers.get('content-range');
        if (range) {
            console.log(`Total rows in 'wraps' table (from Content-Range): ${range.split('/')[1]}`);
        }

    } catch (err) {
        console.error('Error fetching wraps:', err);
    }
}

check();
