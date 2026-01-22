const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OSS = require('ali-oss');

const repoRoot = path.resolve(__dirname, '../../..');

// --- Env Loading ---
const loadEnvFileIfPresent = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
            const value = values.join('=').trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = value;
        }
    }
};

loadEnvFileIfPresent(path.join(repoRoot, '.env.local'));
loadEnvFileIfPresent(path.join(repoRoot, 'apps/web/.env.local'));

// --- Configuration ---
const CANONICAL_MODELS = [
    'cybertruck',
    'model-3',
    'model-3-2024-plus',
    'model-y-pre-2025',
    'model-y-2025-plus'
];

const OSS_PREFIX = 'models/wraps/';

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
    console.log('🔥 STARTING OBSOLETE MODEL PURGE 🔥');
    console.log('Canonical Models (Authorized to KEEP):', CANONICAL_MODELS);

    const supabase = getSupabaseAdmin();
    const oss = getOssClient();

    if (!supabase || !oss) {
        console.error('❌ Config missing. Check .env files (need SUPABASE_SERVICE_ROLE_KEY and OSS_* vars).');
        process.exit(1);
    }

    // --- STEP 1: Database Cleanup ---
    console.log('\n--- 1. Cleaning Database ---');

    // First, verify what we are about to delete
    const { data: allModels, error: fetchError } = await supabase
        .from('wrap_models')
        .select('id, slug, model_3d_url');

    if (fetchError) {
        console.error('❌ DB Fetch Error:', fetchError);
        return;
    }

    const dbModelsToDelete = allModels.filter(m => !CANONICAL_MODELS.includes(m.slug));

    if (dbModelsToDelete.length === 0) {
        console.log('✅ Database is already clean.');
    } else {
        console.log(`⚠️ Found ${dbModelsToDelete.length} obsolete models in DB:`);
        dbModelsToDelete.forEach(m => console.log(`   - ${m.slug}`));

        // Execute Delete
        const slugsToDelete = dbModelsToDelete.map(m => m.slug);
        const { error: deleteError } = await supabase
            .from('wrap_models')
            .delete()
            .in('slug', slugsToDelete);

        if (deleteError) {
            console.error('❌ DB Delete Error:', deleteError);
        } else {
            console.log(`✅ Successfully deleted ${slugsToDelete.length} records from DB.`);
        }
    }

    // --- STEP 2: OSS Cleanup ---
    console.log('\n--- 2. Cleaning OSS Storage ---');
    console.log(`Scanning prefix: ${OSS_PREFIX}...`);

    let ossFiles = [];
    let nextMarker = null;
    try {
        do {
            const result = await oss.list({
                prefix: OSS_PREFIX,
                'max-keys': 1000,
                marker: nextMarker
            });
            if (result.objects) {
                ossFiles = ossFiles.concat(result.objects);
            }
            nextMarker = result.nextMarker;
        } while (nextMarker);
    } catch (e) {
        console.error('❌ OSS List Error:', e);
        return;
    }

    // Filter files to delete
    // Expected path structure: models/wraps/{slug}/{filename}
    // We want to delete if {slug} is NOT in CANONICAL_MODELS
    const ossFilesToDelete = ossFiles.filter(file => {
        const relativePath = file.name.slice(OSS_PREFIX.length);
        const slug = relativePath.split('/')[0];
        // If slug is empty (root file) or not in canonical list, delete it
        return !slug || !CANONICAL_MODELS.includes(slug);
    });

    if (ossFilesToDelete.length === 0) {
        console.log('✅ OSS is already clean.');
    } else {
        console.log(`⚠️ Found ${ossFilesToDelete.length} obsolete files in OSS.`);

        // Log a few examples
        console.log('Examples of files to delete:');
        ossFilesToDelete.slice(0, 5).forEach(f => console.log(`   - ${f.name}`));
        if (ossFilesToDelete.length > 5) console.log(`   ... and ${ossFilesToDelete.length - 5} more.`);

        // Batch Delete
        const BATCH_SIZE = 100;
        let deletedCount = 0;
        const keysToDelete = ossFilesToDelete.map(f => f.name);

        for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
            const batch = keysToDelete.slice(i, i + BATCH_SIZE);
            try {
                const result = await oss.deleteMulti(batch, { quiet: true });
                deletedCount += result.deleted ? result.deleted.length : batch.length;
                process.stdout.write(`\r   Deleted ${Math.min(deletedCount, keysToDelete.length)} / ${keysToDelete.length}`);
            } catch (e) {
                console.error(`\n   ❌ OSS Batch Delete Failed:`, e.message);
            }
        }
        console.log(`\n✅ Successfully deleted ${deletedCount} files from OSS.`);
    }

    console.log('\n🎉 PURGE COMPLETE 🎉');
}

main().catch(err => console.error('Fatal Error:', err));
