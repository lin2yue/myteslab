const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const { createClient } = require('@supabase/supabase-js');

// --- Config ---
const repoRoot = path.resolve(__dirname, '..');
const catalogDir = path.join(repoRoot, 'uploads', 'catalog');
const previewsDir = path.join(repoRoot, 'previews');

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
    const cdnBase = process.env.CDN_DOMAIN;
    if (cdnBase) return cdnBase.replace(/\/+$/, '');
    const bucket = process.env.OSS_BUCKET;
    const region = process.env.OSS_REGION;
    return `https://${bucket}.${region}.aliyuncs.com`;
};

// --- Main ---

async function main() {
    console.log('🚀 Starting Full Wrap Sync (Wipe & Upload)...');

    const supabase = getSupabaseAdmin();
    const oss = getOssClient();
    const publicBase = getPublicAssetBase();

    if (!supabase || !oss || !publicBase) {
        console.error('❌ Failed to initialize clients.');
        return;
    }

    // 1. Wipe Existing Data
    console.log('🗑️  Clearing existing wrap data...');
    // Delete mappings first (FK)
    const { error: mapDelError } = await supabase.from('wrap_model_map').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (mapDelError) { console.error('Error clearing maps:', mapDelError); return; }

    // Delete wraps
    const { error: wrapDelError } = await supabase.from('wraps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (wrapDelError) { console.error('Error clearing wraps:', wrapDelError); return; }

    console.log('✅ Database cleared.');

    // 2. Scan Local Catalog
    if (!fs.existsSync(catalogDir)) {
        console.error('Catalog directory not found.');
        return;
    }

    const modelFolders = fs.readdirSync(catalogDir).filter(f => {
        if (f.startsWith('.')) return false;
        return fs.statSync(path.join(catalogDir, f)).isDirectory();
    });

    console.log(`Found models: ${modelFolders.join(', ')}`);

    for (const modelFolder of modelFolders) {
        const modelSlug = modelFolder.toLowerCase(); // DB convention
        console.log(`\n📦 Processing Model: ${modelSlug} (Folder: ${modelFolder})`);

        // Find/Create Model ID in DB
        let { data: modelData, error: modelErr } = await supabase
            .from('wrap_models')
            .select('id')
            .eq('slug', modelSlug)
            .single();

        if (!modelData) {
            console.log(`   Model ${modelSlug} not found in DB. Creating...`);
            const { data: newModel, error: createErr } = await supabase
                .from('wrap_models')
                .insert({ slug: modelSlug, name: modelFolder, is_active: true })
                .select()
                .single();
            if (createErr) { console.error(`   ❌ Failed to create model: ${createErr.message}`); continue; }
            modelData = newModel;
        }

        const modelId = modelData.id;
        const wrapsBaseDir = path.join(catalogDir, modelFolder, 'wraps');

        if (!fs.existsSync(wrapsBaseDir)) continue;

        const categories = fs.readdirSync(wrapsBaseDir);
        for (const cat of categories) {
            if (cat.startsWith('.')) continue;
            const catDir = path.join(wrapsBaseDir, cat);
            if (!fs.statSync(catDir).isDirectory()) continue;

            const files = fs.readdirSync(catDir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));

            for (const f of files) {
                const nameNoExt = path.parse(f).name;
                const wrapSlug = nameNoExt.toLowerCase().replace(/[\s_]+/g, '-');
                const displayName = nameNoExt.replace(/_/g, ' ');

                // Paths
                const localTexturePath = path.join(catDir, f);

                // Construct Preview Filename based on generate_previews.js logic:
                // const localFilename = `${model.slug}-${wrap.category.toLowerCase()}-${wrap.slug}.png`;
                // model.slug is lowercase modelFolder
                const expectedPreviewName = `${modelSlug}-${cat.toLowerCase()}-${wrapSlug}.png`;
                const localPreviewPath = path.join(previewsDir, modelSlug, expectedPreviewName);

                if (!fs.existsSync(localPreviewPath)) {
                    console.warn(`   ⚠️ Preview missing: ${expectedPreviewName}. Skipping.`);
                    continue;
                }

                console.log(`   Uploading: ${displayName}...`);

                // Upload Texture
                const textureOssKey = `catalog/${modelSlug}/wraps/${cat}/${f}`; // Structure preserved
                await oss.put(textureOssKey, localTexturePath);
                const textureUrl = `${publicBase}/${textureOssKey}`;

                // Upload Preview
                const previewOssKey = `previews/${modelSlug}/${expectedPreviewName}`;
                await oss.put(previewOssKey, localPreviewPath);
                const previewUrl = `${publicBase}/${previewOssKey}`;

                // Insert into Wraps
                // Note: We create a specific wrap entry for this model to ensure valid linkage
                const { data: wrapEntry, error: insertError } = await supabase
                    .from('wraps')
                    .insert({
                        slug: `${modelSlug}-${wrapSlug}`, // Unique slug per model-wrap combo
                        name: displayName,
                        category: cat,
                        wrap_image_url: textureUrl,
                        preview_image_url: previewUrl,
                        is_active: true
                    })
                    .select('id')
                    .single();

                if (insertError) {
                    console.error(`   ❌ DB Insert Failed: ${insertError.message}`);
                    continue;
                }

                // Link Wrap to Model
                const { error: linkError } = await supabase
                    .from('wrap_model_map')
                    .insert({
                        wrap_id: wrapEntry.id,
                        model_id: modelId
                    });

                if (linkError) {
                    console.error(`   ❌ Link Failed: ${linkError.message}`);
                }
            }
        }
    }
    console.log('\n✅ All Done!');
}

main().catch(console.error);
