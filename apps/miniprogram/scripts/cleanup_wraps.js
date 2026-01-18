const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

async function main() {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    console.log('Fetching active wraps...');
    const { data: wraps, error: wrapsError } = await supabase
        .from('wraps')
        .select('*')
        .eq('is_active', true);

    if (wrapsError) {
        console.error('Error fetching wraps:', wrapsError);
        return;
    }

    console.log(`Found ${wraps.length} active wraps. Verifying local files...`);

    const missingIds = [];
    const possibleModelDirs = [
        'model-y-2025-standard',
        'model-3-highland',
        'cybertruck',
        'model-y',
        'model-3'
    ];

    for (const wrap of wraps) {
        if (!wrap.wrap_image_url) {
            console.error(`[MISSING URL] Wrap ID: ${wrap.id} Name: ${wrap.name} has no wrap_image_url`);
            missingIds.push(wrap.id);
            continue;
        }

        const filename = path.basename(wrap.wrap_image_url);
        const decodedFilename = decodeURIComponent(filename);
        let found = false;

        // 1. Check if it is a local path in the URL itself
        if (wrap.wrap_image_url.startsWith('/')) {
            const directPath = path.join(repoRoot, wrap.wrap_image_url);
            if (fs.existsSync(directPath)) {
                found = true;
            }
        }

        // 2. Search in common model directories if not found
        if (!found && wrap.category) {
            for (const modelSlug of possibleModelDirs) {
                const candidatePath = path.join(repoRoot, 'uploads', 'catalog', modelSlug, 'wraps', wrap.category, decodedFilename);
                if (fs.existsSync(candidatePath)) {
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            missingIds.push(wrap.id);
            console.log(`❌ MARK FOR DELETE: ${wrap.name} (${wrap.category}) - ${wrap.wrap_image_url}`);
        }
    }

    console.log(`\nFound ${missingIds.length} wraps to delete.`);

    if (missingIds.length > 0) {
        // Step 1: Delete mappings first to avoid FK constraints issues (just in case cascade isn't set)
        console.log('Deleting associated wrap_model_map entries...');
        const { error: mapError } = await supabase
            .from('wrap_model_map')
            .delete()
            .in('wrap_id', missingIds);

        if (mapError) {
            console.error('Error deleting mappings:', mapError);
        } else {
            console.log('✅ Mappings deleted.');
        }

        // Step 2: Delete wraps
        console.log('Deleting wraps...');
        const { error: deleteError } = await supabase
            .from('wraps')
            .delete()
            .in('id', missingIds);

        if (deleteError) {
            console.error('Error deleting wraps:', deleteError);
        } else {
            console.log(`✅ Successfully deleted ${missingIds.length} wraps.`);
        }
    } else {
        console.log('No wraps need to be deleted.');
    }
}

main().catch(console.error);
