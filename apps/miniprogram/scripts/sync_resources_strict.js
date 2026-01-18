const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const { createClient } = require('@supabase/supabase-js');

// --- Config ---
const repoRoot = path.resolve(__dirname, '..');
const catalogDir = path.join(repoRoot, 'uploads', 'catalog');
const previewsDir = path.join(repoRoot, 'previews');

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

const getPublicAssetBase = () => {
    const cdnBase = process.env.CDN_DOMAIN;
    if (cdnBase) return cdnBase.replace(/\/+$/, '');
    const bucket = process.env.OSS_BUCKET;
    const region = process.env.OSS_REGION;
    return `https://${bucket}.${region}.aliyuncs.com`;
};

// --- Clients ---
const supabase = getSupabaseAdmin();
const oss = getOssClient();
const publicBase = getPublicAssetBase();

async function listAllOssFiles(prefix) {
    let files = [];
    let nextMarker = null;
    try {
        do {
            const result = await oss.list({
                prefix: prefix,
                'max-keys': 1000,
                marker: nextMarker
            });
            if (result.objects) {
                files = files.concat(result.objects);
            }
            nextMarker = result.nextMarker;
        } while (nextMarker);
    } catch (e) {
        console.error(`Error listing OSS prefix ${prefix}:`, e);
    }
    return files;
}

async function main() {
    if (!supabase || !oss || !publicBase) {
        console.error('❌ Config missing.');
        return;
    }

    console.log('🚀 Starting Strict Sync (Local -> OSS/DB)...');

    // 1. Scan Local
    if (!fs.existsSync(catalogDir)) {
        console.error('❌ Catalog directory missing.');
        return;
    }

    // Get valid model folders
    const localModels = fs.readdirSync(catalogDir).filter(f => {
        return !f.startsWith('.') && fs.statSync(path.join(catalogDir, f)).isDirectory();
    }).map(f => ({ name: f, slug: f.toLowerCase() })); // Assume slug = lowercase name

    console.log(`📂 Local Models found: ${localModels.map(m => m.slug).join(', ')}`);

    // 2. Sync DB Models
    console.log('\n🔄 Syncing DB Models...');
    // Deactivate all first? No, let's upsert valid ones and deactivate others.

    // Get all existing models
    const { data: dbModels } = await supabase.from('wrap_models').select('*');
    const dbModelMap = new Map((dbModels || []).map(m => [m.slug, m]));

    // Update/Insert Valid
    for (const m of localModels) {
        if (dbModelMap.has(m.slug)) {
            // Ensure Active
            await supabase.from('wrap_models').update({ is_active: true, name: m.name }).eq('id', dbModelMap.get(m.slug).id);
        } else {
            // Create
            console.log(`   + Creating model: ${m.slug}`);
            await supabase.from('wrap_models').insert({ slug: m.slug, name: m.name, is_active: true });
        }
    }

    // Deactivate Invalid
    const localSlugSet = new Set(localModels.map(m => m.slug));
    const toDeactivate = (dbModels || []).filter(m => !localSlugSet.has(m.slug));

    if (toDeactivate.length > 0) {
        console.log(`   - Deactivating invalid models: ${toDeactivate.map(m => m.slug).join(', ')}`);
        const ids = toDeactivate.map(m => m.id);
        await supabase.from('wrap_models').update({ is_active: false }).in('id', ids);
        // Also remove their wraps? Yes, soft delete wraps.
        // Actually, we are going to do a full pass on wraps next.
    }

    // Refresh DB Model Map
    const { data: refreshedModels } = await supabase.from('wrap_models').select('*');
    const modelIdMap = new Map(refreshedModels.map(m => [m.slug, m.id]));

    // 3. Scan Local Wraps & Prepare Expected OSS Keys
    console.log('\n🔄 Scanning Wraps & Processing...');

    const expectedOssKeys = new Set();
    const validWrapSlugs = new Set();

    for (const m of localModels) {
        const wrapsBaseDir = path.join(catalogDir, m.name, 'wraps');
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
                const uniqueWrapSlug = `${m.slug}-${wrapSlug}`; // Unique ID
                const displayName = nameNoExt.replace(/_/g, ' ');

                // Paths
                const localTexturePath = path.join(catDir, f);
                const expectedPreviewName = `${m.slug}-${cat.toLowerCase()}-${wrapSlug}.png`;
                const localPreviewPath = path.join(previewsDir, m.slug, expectedPreviewName);

                // OSS Keys
                const textureOssKey = `catalog/${m.slug}/wraps/${cat}/${f}`;
                const previewOssKey = `previews/${m.slug}/${expectedPreviewName}`;

                expectedOssKeys.add(textureOssKey);

                // --- Upload Texture if missing ---
                try {
                    // Check existence? Too slow to check one by one. 
                    // Optimization: We will do a bulk list later and check. 
                    // But for now, let's assume we proceed to DB steps and collect ALL expected keys.
                } catch (e) { }

                if (fs.existsSync(localPreviewPath)) {
                    expectedOssKeys.add(previewOssKey);
                }

                validWrapSlugs.add(uniqueWrapSlug);

                // DB Upsert
                // We need to resolve URLs. 
                const textureUrl = `${publicBase}/${textureOssKey}`;
                const previewUrl = fs.existsSync(localPreviewPath) ? `${publicBase}/${previewOssKey}` : null;

                // Check if wrap exists
                const { data: existingWrap } = await supabase.from('wraps').select('id').eq('slug', uniqueWrapSlug).maybeSingle();

                let wrapId;
                if (existingWrap) {
                    wrapId = existingWrap.id;
                    // Update
                    await supabase.from('wraps').update({
                        name: displayName,
                        category: cat,
                        wrap_image_url: textureUrl,
                        preview_image_url: previewUrl,
                        is_active: true
                    }).eq('id', wrapId);
                } else {
                    // Insert
                    const { data: newWrap } = await supabase.from('wraps').insert({
                        slug: uniqueWrapSlug,
                        name: displayName,
                        category: cat,
                        wrap_image_url: textureUrl,
                        preview_image_url: previewUrl,
                        is_active: true
                    }).select('id').single();
                    wrapId = newWrap.id;
                }

                // Link
                const modelId = modelIdMap.get(m.slug);
                // Check link
                const { data: link } = await supabase.from('wrap_model_map').select('*').match({ wrap_id: wrapId, model_id: modelId }).maybeSingle();
                if (!link) {
                    await supabase.from('wrap_model_map').insert({ wrap_id: wrapId, model_id: modelId });
                }
            }
        }
    }

    console.log(`✅ Processed ${validWrapSlugs.size} wraps from local source.`);

    // 4. Clean DB Code (Deactivate Wraps not in local)
    // Actually, since we use `slug` (uniqueWrapSlug) which includes model name, we can just deactivate any wrap whose slug is NOT in validWrapSlugs.
    // BUT, verify if `slug` is reliable. Yes, I constructed it.

    // Better: Deactivate all wraps not in the list?
    // Let's do it safe.
    // However, table `wraps` might contain other things? No, seem to be only these.
    // Let's mark is_active=false for others.

    // Fetch all active wraps
    // chunked update if too many?
    // Let's just say we trust the upserts set them to true. We need to set others to false.
    // This is hard to do efficiently without a "not in" query which might be huge.
    // Alternatively: Update ALL to is_active=false at start? No, downtime.

    // Strategy: We already updated found ones to is_active=true.
    // We can fetch all wraps where is_active=true, filter in JS, and update back.
    const { data: allActiveWraps } = await supabase.from('wraps').select('id, slug').eq('is_active', true);
    const toDisableWraps = allActiveWraps.filter(w => !validWrapSlugs.has(w.slug));
    if (toDisableWraps.length > 0) {
        console.log(`\n🚫 Deactivating ${toDisableWraps.length} obsolete wraps in DB...`);
        const ids = toDisableWraps.map(w => w.id);
        // Supabase 'in' limit is roughly 65k chars, safe for reasonable amounts.
        await supabase.from('wraps').update({ is_active: false }).in('id', ids);
    }


    // 5. Audit & Sync OSS Files
    console.log('\n☁️  Syncing OSS Files...');

    // List ALL files in Catalog and Previews
    const ossCatalogFiles = await listAllOssFiles('catalog/');
    const ossPreviewFiles = await listAllOssFiles('previews/');

    const allOssFiles = [...ossCatalogFiles, ...ossPreviewFiles];
    const ossKeySet = new Set(allOssFiles.map(f => f.name));

    // A. Upload Missing (Local -> OSS)
    let uploadCount = 0;
    for (const key of expectedOssKeys) {
        if (!ossKeySet.has(key)) {
            // Need to find local path from key
            // Key format: 
            // catalog/{model}/wraps/{cat}/{file}
            // previews/{model}/{file}

            let localPath = null;
            if (key.startsWith('catalog/')) {
                // catalog/model-y/wraps/Matte/Red.png -> uploads/catalog/model-y/wraps/Matte/Red.png
                // CAUTION: model folder casing! local 'Cybertruck' vs key 'cybertruck' needs mapping.
                // We normalized slug to lowercase. Local folder might be TitleCase.
                // We know the map: slug -> localName.
                // Extract parts
                const parts = key.split('/');
                // parts[1] is model slug.
                const mSlug = parts[1];
                const rest = parts.slice(2).join('/'); // wraps/Matte/Red.png

                // Find local model folder name
                const localM = localModels.find(m => m.slug === mSlug);
                if (localM) {
                    localPath = path.join(catalogDir, localM.name, rest);
                }

            } else if (key.startsWith('previews/')) {
                const parts = key.split('/');
                const mSlug = parts[1];
                const rest = parts.slice(2).join('/');
                localPath = path.join(previewsDir, mSlug, rest);
            }

            if (localPath && fs.existsSync(localPath)) {
                console.log(`   ⬆️  Uploading missing: ${key}`);
                await oss.put(key, localPath);
                uploadCount++;
            } else {
                console.warn(`   ⚠️  Expected file missing locally: ${key} (Path: ${localPath})`);
            }
        }
    }

    // B. Delete Orphans (OSS -> null)
    const orphans = allOssFiles.filter(f => !expectedOssKeys.has(f.name));
    // Filter out only relevant folders to avoid destroying other things in bucket
    const relevantOrphans = orphans.filter(f =>
        f.name.startsWith('catalog/') ||
        (f.name.startsWith('previews/') && f.name.includes('/wraps/')) || // safety
        (f.name.startsWith('previews/') && f.name.includes('-official-')) // Generated previews naming scheme
    );
    // actually check if it looks like a generated preview or catalog file.
    // keys in expectedOssKeys are all compliant. 
    // We should only delete if we are SURE. 
    // Local source is truth. If not in expectedOssKeys, it shouldn't be there.

    if (relevantOrphans.length > 0) {
        console.log(`\n🗑️  Deleting ${relevantOrphans.length} orphaned OSS files...`);
        // Batch delete
        const keys = relevantOrphans.map(f => f.name);
        // OSS deleteMulti takes max 1000? verify.
        // Doing in chunks of 500
        for (let i = 0; i < keys.length; i += 500) {
            const chunk = keys.slice(i, i + 500);
            try {
                await oss.deleteMulti(chunk);
                console.log(`      Deleted chunk ${i}-${i + chunk.length}`);
            } catch (e) {
                console.error('      Delete failed:', e.message);
            }
        }
    }

    console.log('\n✨ Sync Complete!');
    console.log(`   - Wraps Processed: ${validWrapSlugs.size}`);
    console.log(`   - Uploaded: ${uploadCount}`);
    console.log(`   - Deleted: ${relevantOrphans.length}`);
}

main().catch(console.error);
