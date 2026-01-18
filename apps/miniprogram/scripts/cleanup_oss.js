const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OSS = require('ali-oss');

const repoRoot = path.resolve(__dirname, '..');

// --- Env Loading ---
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

    // 1. Get Active Files from DB
    console.log('🔍 Fetching database records (source of truth)...');
    const { data: wraps, error } = await supabase
        .from('wraps')
        .select('preview_image_url');

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    const activeOssKeys = new Set();
    wraps.forEach(w => {
        if (w.preview_image_url && w.preview_image_url.includes('cdn.tewan.club')) {
            try {
                const u = new URL(w.preview_image_url);
                let key = u.pathname;
                if (key.startsWith('/')) key = key.slice(1);
                activeOssKeys.add(decodeURIComponent(key));
            } catch (e) { }
        }
    });
    console.log(`✅ Identified ${activeOssKeys.size} active files from DB.`);

    // 2. List All Files on OSS
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

    // 3. Identify Orphans
    const toDelete = [];
    ossFiles.forEach(file => {
        if (!activeOssKeys.has(file.name)) {
            toDelete.push(file.name);
        }
    });

    console.log(`\n📋 Found ${toDelete.length} files to delete (not in DB).`);

    if (toDelete.length === 0) {
        console.log('✨ Nothing to clean.');
        return;
    }

    // 4. Batch Delete
    console.log('🔥 Deleting files in batches of 100...');
    const BATCH_SIZE = 100;
    let deletedCount = 0;

    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = toDelete.slice(i, i + BATCH_SIZE);
        try {
            // OSS deleteMulti takes array of names
            const result = await oss.deleteMulti(batch, { quiet: true });
            deletedCount += result.deleted ? result.deleted.length : batch.length; // quiet mode might not return details
            process.stdout.write(`\r   Deleted ${Math.min(deletedCount, toDelete.length)} / ${toDelete.length}`);
        } catch (e) {
            console.error(`\n   ❌ Batch failed:`, e.message);
        }
    }

    console.log(`\n\n🎉 Cleanup complete. Deleted ${toDelete.length} files.`);
}

main();
