const fs = require('fs');
const path = require('path');
const glob = require('glob');
const OSS = require('ali-oss');
const { createClient } = require('@supabase/supabase-js');

// Config
const repoRoot = path.resolve(__dirname, '..');
const PREVIEWS_DIR = path.join(repoRoot, 'assets', '3d-previews');

// --- Helpers ---

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

const getOssClient = () => {
    const { OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET } = process.env;
    if (!OSS_REGION || !OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET || !OSS_BUCKET) {
        console.error('Missing OSS env vars for upload.');
        return null;
    }
    return new OSS({
        region: OSS_REGION,
        accessKeyId: OSS_ACCESS_KEY_ID,
        accessKeySecret: OSS_ACCESS_KEY_SECRET,
        bucket: OSS_BUCKET,
        secure: true,
    });
};

const getPublicAssetBase = () => {
    const cdnBase = process.env.CDN_DOMAIN; // e.g., https://cdn.tewan.club
    if (cdnBase) return cdnBase.replace(/\/+$/, '');

    // Fallback
    const bucket = process.env.OSS_BUCKET;
    const region = process.env.OSS_REGION;
    return `https://${bucket}.${region}.aliyuncs.com`;
};

// --- Main ---

async function main() {
    console.log('🚀 Starting Batch Upload for Previews...');

    const supabase = getSupabaseAdmin();
    const oss = getOssClient();
    const publicBase = getPublicAssetBase();

    if (!supabase || !oss || !publicBase) {
        console.error('❌ Failed to initialize clients.');
        return;
    }

    // 1. Find all png files in previews folder
    // Structure: previews/[model_slug]/[wrap_slug].png
    const pattern = path.join(PREVIEWS_DIR, '**/*.png');
    const files = glob.sync(pattern);

    if (files.length === 0) {
        console.log('No preview files found to upload.');
        return;
    }

    console.log(`found ${files.length} images.`);

    let successCount = 0;

    for (const filePath of files) {
        const filename = path.basename(filePath); // e.g. "matte_black.png"
        const dir = path.dirname(filePath);
        const folderName = path.basename(dir); // e.g. "cybertruck" (model slug)

        // We assume filename (minus ext) is the wrap slug
        const wrapSlug = filename.replace(/\.png$/, '');
        const modelSlug = folderName;

        // Verify it looks like a valid preview file path
        if (dir === PREVIEWS_DIR) {
            // It's in the root of previews/, skip or handle differently?
            // Current strict logic expects previews/[model]/[wrap].png
            console.log(`Skipping root file: ${filename}`);
            continue;
        }

        console.log(`Processing: [${modelSlug}] ${wrapSlug}`);

        // 2. Upload to OSS
        // Key format: previews/wraps/[model_slug]-[wrap_slug]-v[timestamp].png
        const timestamp = Date.now();
        const ossKey = `previews/wraps/${modelSlug}-${wrapSlug}-v${timestamp}.png`;

        try {
            await oss.put(ossKey, filePath);
            const previewUrl = `${publicBase}/${ossKey}`; // encodeURI if needed, but these slugs are usually safe

            console.log(`   cloud: ${previewUrl}`);

            // 3. Update Supabase
            // We need to find the wrap ID. We can try to look it up by slug, but wrap slugs might not be globally unique?
            // Actually, `wraps` table usually has `slug` which is unique PER MODEL or globally?
            // In the `generate_previews` script, we iterated models then wraps.
            // Here, we have the model_slug and wrap_slug.

            // Let's find the model ID first
            const { data: models } = await supabase.from('wrap_models').select('id').eq('slug', modelSlug).single();
            if (!models) {
                console.warn(`   ⚠️ Model not found: ${modelSlug}`);
                continue;
            }

            // Now find wrap that is linked to this model AND has this slug.
            // This is tricky if `wraps` table doesn't have model_id directly but uses `wrap_model_map`.
            // But usually `wraps` has a `slug`.

            // NOTE: If your wraps are shared across models, a wrap might have ONE slug but multiple previews?
            // The `wraps` table has `preview_image_url`. If a wrap is shared, does it have one preview?
            // If it has multiple (one per model), then the data model might not support individual previews per model unless 
            // `wraps` entries are duplicated per model OR `preview_image_url` is on the mapping table.
            // **Assumption**: Based on `generate_previews.js`, we were updating `wraps` table directly:
            // `await supabase.from('wraps').update({ preview_image_url: previewUrl }).eq('id', wrap.id);`
            // This implies the wrap entry is specific to the model OR we are overwriting it with the latest model's preview.
            // If `wraps` are shared, this overwrites.
            // However, looking at the previous script, it was iterating models, then wraps linked to it.

            // For now, I will perform the update on the `wraps` table where slug matches.
            // If multiple records match the slug (rare), update all?

            const { data: wrapData, error: findError } = await supabase
                .from('wraps')
                .select('id')
                .eq('slug', wrapSlug);

            if (findError || !wrapData || wrapData.length === 0) {
                console.warn(`   ⚠️ Wrap not found in DB: ${wrapSlug}`);
                continue;
            }

            // Update all matching wraps? 
            // If we are generating for Cybertruck, and we update "matte_black", 
            // and then we generate for Model Y "matte_black", we overwrite it.
            // This seems to be the existing architectural limitation or feature. 
            // I will maintain this behavior.

            const ids = wrapData.map(w => w.id);
            const { error: updateError } = await supabase
                .from('wraps')
                .update({ preview_image_url: previewUrl })
                .in('id', ids);

            if (updateError) {
                console.error(`   ❌ DB Update failed: ${updateError.message}`);
            } else {
                console.log(`   ✅ Synced to DB!`);
                successCount++;

                // Optional: Rename/Move local file to indicate it's uploaded?
                // For now, leave it.
            }

        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);
        }
    }

    console.log(`\n🎉 Upload Complete. ${successCount} files processed.`);
}

main().catch(console.error);
