const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OSS = require('ali-oss');

const repoRoot = path.resolve(__dirname, '..');

// --- Env Loading (Copied from generate_previews.js) ---
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

// --- Clients ---
const getSupabaseAdmin = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
};

const getOssClient = () => {
    const { OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET } = process.env;
    if (!OSS_REGION || !OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET || !OSS_BUCKET) return null;
    return new OSS({
        region: OSS_REGION,
        accessKeyId: OSS_ACCESS_KEY_ID,
        accessKeySecret: OSS_ACCESS_KEY_SECRET,
        bucket: OSS_BUCKET,
        secure: true,
    });
};

async function main() {
    const supabase = getSupabaseAdmin();
    const oss = getOssClient();

    if (!supabase || !oss) {
        console.error('❌ Config missing. Check .env files.');
        return;
    }

    console.log('🔍 Fetching database records...');
    const { data: wraps, error } = await supabase
        .from('wraps')
        .select('id, slug, preview_image_url');

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    // Extract keys from DB URLs
    // DB URL example: https://cdn.tewan.club/previews/wraps/cybertruck-official-police-v123456.png
    // OSS Key example: previews/wraps/cybertruck-official-police-v123456.png
    const activeOssKeys = new Set();
    wraps.forEach(w => {
        if (w.preview_image_url) {
            try {
                const u = new URL(w.preview_image_url);
                // Assuming the path in URL matches OSS key. 
                // URL path: /previews/wraps/... 
                // OSS Key: previews/wraps/... (no leading slash usually)
                let key = u.pathname;
                if (key.startsWith('/')) key = key.slice(1);
                activeOssKeys.add(decodeURIComponent(key));
            } catch (e) {
                // ignore invalid urls
            }
        }
    });

    console.log(`✅ Found ${wraps.length} wraps in DB (${activeOssKeys.size} have valid preview URLs).`);

    console.log('🔍 Listing OSS files in previews/wraps/...');
    let ossFiles = [];
    let nextMarker = null;

    try {
        do {
            const result = await oss.list({
                prefix: 'previews/wraps/',
                'max-keys': 1000,
                marker: nextMarker
            });
            if (result.objects) {
                ossFiles = ossFiles.concat(result.objects);
            }
            nextMarker = result.nextMarker;
        } while (nextMarker);
    } catch (e) {
        console.error('OSS List Error:', e);
        return;
    }

    console.log(`✅ Found ${ossFiles.length} files on OSS.`);

    const redundancy = [];
    let redundancySize = 0;

    ossFiles.forEach(file => {
        // Decode key to match DB (DB URLs might be encoded or not, but usually we store encoded or raw. 
        // Safe bet is to compare decoded versions)
        const key = file.name;
        if (!activeOssKeys.has(key)) {
            redundancy.push(file);
            redundancySize += file.size;
        }
    });

    const mbSize = (redundancySize / 1024 / 1024).toFixed(2);
    console.log('\n--- Analysis Result ---');
    console.log(`🗑️  Redundant/Orphaned Files: ${redundancy.length}`);
    console.log(`💾  Total Wasted Space: ${mbSize} MB`);

    if (redundancy.length > 0) {
        console.log('\nExample orphaned files:');
        redundancy.slice(0, 5).forEach(f => console.log(` - ${f.name} (${(f.size / 1024).toFixed(1)}KB)`));

        const latestTimestamp = new Date().getTime();
        const outputJson = path.join(repoRoot, `oss_cleanup_candidates_${latestTimestamp}.json`);
        fs.writeFileSync(outputJson, JSON.stringify(redundancy.map(f => f.name), null, 2));
        console.log(`\n📋 Full list saved to: ${outputJson}`);
    } else {
        console.log('\n✨ OSS is clean! No redundant files found.');
    }
}

main();
