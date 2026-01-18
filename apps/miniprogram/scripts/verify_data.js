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

    let missingCount = 0;
    const missingReports = [];

    // Fallback logic mirror from generate_previews.js
    // We need to check if the file exists in likely locations

    // We don't have model info for each wrap directly here unless we join, 
    // but the file structure is usually /uploads/catalog/<model>/wraps/<category>/<filename>
    // However, the `wraps` table entry often has `wrap_image_url` pointing to OSS/CDN or a relative path.
    // If it's a full URL, we need to extract the filename and check if we have it locally *somewhere*.
    // The previous logic in generate_previews.js tries to look it up by category/filename in model folders.

    // Let's check typical paths.
    // NOTE: In the current system, one wrap can be applied to multiple models.
    // The source texture is usually shared or duplicated.
    // Let's just check if we can find *at least one* valid local file for this wrap's texture.

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
            missingCount++;
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
                    // console.log(`   Found at: ${candidatePath}`);
                    break;
                }
            }
        }

        if (!found) {
            missingCount++;
            missingReports.push({
                id: wrap.id,
                name: wrap.name,
                category: wrap.category,
                url: wrap.wrap_image_url
            });
            console.log(`❌ MISSING FILE: ${wrap.name} (${wrap.category}) - ${wrap.wrap_image_url}`);
        }
    }

    console.log('\n--- Verification Summary ---');
    console.log(`Total Wraps Checked: ${wraps.length}`);
    console.log(`Missing Files: ${missingCount}`);

    if (missingCount > 0) {
        console.log('\nDetails of missing items:');
        missingReports.forEach(r => {
            console.log(`- ${r.name} [${r.category}]: ${r.url}`);
        });
    } else {
        console.log('✅ All wrap files authenticated present on disk.');
    }
}

main().catch(console.error);
