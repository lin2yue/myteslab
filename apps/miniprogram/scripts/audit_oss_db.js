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

function getOssKeyFromUrl(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        let key = u.pathname;
        if (key.startsWith('/')) key = key.slice(1);
        return decodeURIComponent(key);
    } catch (e) {
        return null;
    }
}

async function listAllOssFiles(oss, prefix) {
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
    const supabase = getSupabaseAdmin();
    const oss = getOssClient();

    if (!supabase || !oss) {
        console.error('❌ Config missing. Check .env files.');
        return;
    }

    console.log('🔍 Fetching database records (wraps)...');
    const { data: wraps, error } = await supabase
        .from('wraps')
        .select('id, slug, name, wrap_image_url, preview_image_url');

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    // 1. Build Index of Expected Keys
    const expectedKeys = new Set();
    const dbRefs = []; // Store detailed refs for reverse lookup if needed

    wraps.forEach(w => {
        if (w.wrap_image_url) {
            const key = getOssKeyFromUrl(w.wrap_image_url);
            if (key) {
                expectedKeys.add(key);
                dbRefs.push({ type: 'texture', id: w.id, slug: w.slug, key, url: w.wrap_image_url });
            }
        }
        if (w.preview_image_url) {
            const key = getOssKeyFromUrl(w.preview_image_url);
            if (key) {
                expectedKeys.add(key);
                dbRefs.push({ type: 'preview', id: w.id, slug: w.slug, key, url: w.preview_image_url });
            }
        }
    });

    console.log(`✅ Found ${wraps.length} wraps, referencing ${expectedKeys.size} unique OSS files.`);

    // 2. List OSS Files
    console.log('🔍 Listing OSS files (previews/ & catalog/)...');
    const previewFiles = await listAllOssFiles(oss, 'previews/');

    // For catalog, we only care about files that look like textures (e.g., inside 'wraps' folder or images)
    // To be safe and efficient, let's list 'catalog/' and filter.
    const catalogFilesAll = await listAllOssFiles(oss, 'catalog/');
    // Filter catalog files to only those that are likely textures (contain '/wraps/')
    const catalogFiles = catalogFilesAll.filter(f => f.name.includes('/wraps/') || f.name.match(/\.(png|jpg|jpeg)$/i));

    const allOssFiles = [...previewFiles, ...catalogFiles];

    // Map of Key -> FileObj
    const ossMap = new Map();
    allOssFiles.forEach(f => ossMap.set(f.name, f));

    console.log(`✅ Found ${allOssFiles.length} relevant files on OSS.`);

    // 3. Analysis
    const brokenLinks = [];
    const orphans = [];

    // Check for Broken Links (DB has URL, OSS missing file)
    dbRefs.forEach(ref => {
        if (!ossMap.has(ref.key)) {
            brokenLinks.push(ref);
        }
    });

    // Check for Orphans (OSS has file, DB missing ref)
    allOssFiles.forEach(f => {
        if (!expectedKeys.has(f.name)) {
            // Double check: sometimes encoding differs. 
            // We tried to decode expectedKeys. Let's try to match raw filename too if needed.
            // But usually file.name comes back decoded-ish.
            orphans.push(f);
        }
    });

    // 4. Report
    console.log('\n====== AUDIT REPORT ======');
    console.log(`DB References: ${dbRefs.length}`);
    console.log(`OSS Files scanned: ${allOssFiles.length}`);

    if (brokenLinks.length > 0) {
        console.log(`\n❌ BROKEN LINKS (In DB, missing on OSS): ${brokenLinks.length}`);
        brokenLinks.slice(0, 10).forEach(b => {
            console.log(` - [${b.type}] ${b.slug} -> ${b.key}`);
        });
        if (brokenLinks.length > 10) console.log(`   ... and ${brokenLinks.length - 10} more.`);
    } else {
        console.log('\n✅ No broken links found.');
    }

    if (orphans.length > 0) {
        console.log(`\n🗑️  ORPHANED FILES (On OSS, unused by DB): ${orphans.length}`);
        const totalSize = orphans.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024;
        console.log(`   Total wasted space: ${totalSize.toFixed(2)} MB`);

        console.log('   Example orphans:');
        orphans.slice(0, 10).forEach(f => {
            console.log(` - ${f.name} (${(f.size / 1024).toFixed(1)}KB)`);
        });

        // Save orphans list
        const latestTimestamp = new Date().getTime();
        const orphanFile = path.join(repoRoot, `oss_audit_orphans_${latestTimestamp}.json`);
        fs.writeFileSync(orphanFile, JSON.stringify(orphans.map(f => f.name), null, 2));
        console.log(`\n📋 Full orphan list saved to: ${orphanFile}`);
    } else {
        console.log('\n✨ No orphaned files found.');
    }
}

main().catch(console.error);
