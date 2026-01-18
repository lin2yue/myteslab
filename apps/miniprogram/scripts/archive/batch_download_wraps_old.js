const fs = require('fs');
const path = require('path');
const https = require('https');
const OSS = require('ali-oss');
const { createClient } = require('@supabase/supabase-js');

const repoRoot = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(repoRoot, 'uploads/catalog');
const BASE_WRAP_URL = 'https://teslawrapgallery.com/wrap_templates/official/';

// Env Loading
const loadEnvFileIfPresent = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (value.startsWith('"') || value.startsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
    }
};
loadEnvFileIfPresent(path.join(repoRoot, '.env'));
loadEnvFileIfPresent(path.join(repoRoot, '.env.local'));

// Supabase & OSS Config
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ossClient = new OSS({
    region: process.env.OSS_REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET
});
const safeDecode = (value) => {
    try {
        return decodeURIComponent(value);
    } catch (err) {
        return value;
    }
};

const encodePathSegments = (input) => String(input || '')
    .split('/')
    .map((segment) => encodeURIComponent(safeDecode(segment)))
    .join('/');

const normalizeBaseUrl = (input) => String(input || '').replace(/\/+$/, '');

const ossBase = `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com`;
const publicBase = normalizeBaseUrl(process.env.CDN_DOMAIN) || ossBase;

// Targeted Models and their remote directory names
const TARGETS = [
    { slug: 'model-3-highland', remoteDir: 'model3-2024-base' },
    { slug: 'model-y-2025-premium', remoteDir: 'modely-2025-premium' }
];

// Scraped Wraps (Standard list for both)
const WRAPS = [
    'Doge', 'Acid_Drip', 'Ani', 'Apocalypse', 'Avocado_Green', 'Camo',
    'Cosmic_Burst', 'Divide', 'Dot_Matrix', 'Ice_Cream', 'Leopard',
    'Pixel_Art', 'Reindeer', 'Rudi', 'Sakura', 'Sketch',
    'String_Lights', 'Valentine', 'Vintage_Gradient', 'Vintage_Stripes'
];

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                file.close(); fs.unlinkSync(dest);
                return reject(new Error(`Status ${res.statusCode}`));
            }
            res.pipe(file);
            file.on('finish', () => { file.close(resolve); });
        }).on('error', (err) => { fs.unlink(dest, () => { }); reject(err); });
    });
}

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

async function processTarget(target) {
    console.log(`\n--- Processing Wraps for ${target.slug} ---`);
    const modelDir = path.join(OUTPUT_DIR, target.slug);
    const wrapDir = path.join(modelDir, 'wraps/official');
    ensureDir(wrapDir);

    // Get model ID
    const { data: modelData } = await supabase.from('wrap_models').select('id').eq('slug', target.slug).single();
    if (!modelData) {
        console.error(`❌ Model ${target.slug} not found in DB.`);
        return;
    }
    const modelId = modelData.id;

    for (const wrapName of WRAPS) {
        const filename = `${wrapName}.png`;
        const remoteUrl = `${BASE_WRAP_URL}${target.remoteDir}/${filename}`;
        const localPath = path.join(wrapDir, filename);

        // 1. Download
        if (!fs.existsSync(localPath)) {
            try {
                process.stdout.write(`Downloading ${wrapName}... `);
                await downloadFile(remoteUrl, localPath);
                console.log('✅');
            } catch (e) {
                console.log(`❌ Failed: ${e.message}`);
                continue;
            }
        } else {
            console.log(`Skipping download ${wrapName} (exists)`);
        }

        // 2. Upload to OSS
        const ossKey = `wraps/${target.slug}/${filename}`;
        try {
            await ossClient.put(ossKey, localPath);
            const publicUrl = `${publicBase}/${encodePathSegments(ossKey)}`;

            // 3. Register in DB (wraps table)
            // Slug convention: model_slug-wrap_name_lower
            const wrapSlug = `${target.slug}-${wrapName.toLowerCase().replace(/_/g, '-')}`;
            const displayName = wrapName.replace(/_/g, ' ');

            // Upsert wrap
            let { data: wrapData, error: wrapError } = await supabase
                .from('wraps')
                .select('id')
                .eq('slug', wrapSlug)
                .single();

            if (!wrapData) {
                const { data: newWrap, error: createError } = await supabase
                    .from('wraps')
                    .insert({
                        slug: wrapSlug,
                        name: displayName,
                        image_url: publicUrl,
                        category: 'official', // simple category
                        is_public: true
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error(`   ❌ DB Insert Error: ${createError.message}`);
                    continue;
                }
                wrapData = newWrap;
            } else {
                // Update URL if exists
                await supabase.from('wraps').update({ image_url: publicUrl }).eq('id', wrapData.id);
            }

            // 4. Link wrap to model (wrap_model_map)
            const { error: mapError } = await supabase
                .from('wrap_model_map')
                .upsert({
                    wrap_id: wrapData.id,
                    model_id: modelId
                }, { onConflict: 'wrap_id, model_id' }); // Assuming unique constraint exists

            if (mapError) console.error(`   ❌ Map Error: ${mapError.message}`);
            else console.log(`   🔗 Linked: ${displayName}`);

        } catch (e) {
            console.error(`   ❌ Upload/Register Failed: ${e.message}`);
        }
    }
}

async function main() {
    for (const target of TARGETS) {
        await processTarget(target);
    }
    console.log('\n🎉 All Wraps Processed.');
}

main();
