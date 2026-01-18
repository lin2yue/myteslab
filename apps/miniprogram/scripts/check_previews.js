const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

const repoRoot = path.resolve(__dirname, '..');

// Helper to load env files
const loadEnvFileIfPresent = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (!key || process.env[key]) continue;
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
};

loadEnvFileIfPresent(path.join(repoRoot, '.env'));
loadEnvFileIfPresent(path.join(repoRoot, '.env.local'));

const getSupabaseAdmin = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
        return null;
    }
    return createClient(url, key);
};

const checkUrl = (url) => {
    return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.request(url, { method: 'HEAD' }, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 400);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
};

async function main() {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    console.log('Fetching active wraps...');
    const { data: wraps, error: wrapsError } = await supabase
        .from('wraps')
        .select('id, name, slug, preview_image_url')
        .eq('is_active', true);

    if (wrapsError) {
        console.error('Error fetching wraps:', wrapsError);
        return;
    }

    console.log(`Found ${wraps.length} active wraps. Checking previews...`);

    let missingUrlCount = 0;
    let brokenUrlCount = 0;
    const missingReports = [];

    for (const wrap of wraps) {
        // 1. Check if URL exists in DB
        if (!wrap.preview_image_url) {
            missingUrlCount++;
            missingReports.push({ name: wrap.name, reason: 'NULL URL' });
            // console.log(`   [NULL] ${wrap.name}`);
            continue;
        }

        // 2. Check if URL works (simple HEAD check)
        // Only verify if it looks like a remote URL
        if (wrap.preview_image_url.startsWith('http')) {
            const isOk = await checkUrl(wrap.preview_image_url);
            if (!isOk) {
                brokenUrlCount++;
                missingReports.push({ name: wrap.name, reason: `BROKEN URL: ${wrap.preview_image_url}` });
                console.log(`   [BROKEN] ${wrap.name} -> ${wrap.preview_image_url}`);
            }
        } else {
            // Local path?
            console.log(`   [LOCAL?] ${wrap.name} -> ${wrap.preview_image_url}`);
        }
    }

    console.log('\n--- Preview Status Summary ---');
    console.log(`Total Wraps: ${wraps.length}`);
    console.log(`Missing Preview URL (DB is null): ${missingUrlCount}`);
    console.log(`Broken Preview URL (404/Error): ${brokenUrlCount}`);
    console.log(`Total Issues: ${missingUrlCount + brokenUrlCount}`);

    if (missingReports.length > 0) {
        console.log('\nSample of issues:');
        missingReports.slice(0, 10).forEach(r => console.log(`- ${r.name}: ${r.reason}`));
    }
}

main().catch(console.error);
