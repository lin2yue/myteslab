const fs = require('fs');
const path = require('path');
const glob = require('glob');
const OSS = require('ali-oss');
const { createClient } = require('@supabase/supabase-js');

const loadEnvFileIfPresent = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return;

    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        if (!key) continue;
        if (Object.prototype.hasOwnProperty.call(process.env, key) && process.env[key]) continue;

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
};

loadEnvFileIfPresent(path.resolve(__dirname, '..', '.env'));
loadEnvFileIfPresent(path.resolve(__dirname, '..', '.env.local'));

const requiredOss = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET'];
const missingOss = requiredOss.filter((key) => !process.env[key]);

if (missingOss.length) {
    console.error(`Missing env vars: ${missingOss.join(', ')}`);
    process.exit(1);
}

const OSS_CONFIG = {
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET || 'lock-sounds'
};

const requiredSupabase = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingSupabase = requiredSupabase.filter((key) => !process.env[key]);

if (missingSupabase.length) {
    console.error(`Missing env vars: ${missingSupabase.join(', ')}`);
    process.exit(1);
}

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

const ossBase = `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.region}.aliyuncs.com`;
const publicBase = normalizeBaseUrl(process.env.CDN_DOMAIN) || ossBase;
const COVER_FILENAME = 'cover.v2.jpg';

const ossClient = new OSS(OSS_CONFIG);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log('🚀 Starting Cover V2 Uploader...');

    const covers = glob.sync('uploads/audio/*/cover.jpg', { nodir: true });
    if (covers.length === 0) {
        console.log('❌ No cover.jpg found under uploads/*/cover.jpg');
        return;
    }

    console.log(`📂 Found ${covers.length} album covers.`);

    for (const coverPath of covers) {
        await processCover(coverPath);
    }

    console.log('✅ All done!');
}

async function processCover(coverPath) {
    const dir = path.dirname(coverPath);
    const albumName = path.basename(dir);

    if (!fs.existsSync(coverPath)) {
        console.log(`   ⚠️ Missing cover: ${coverPath}`);
        return;
    }

    const ossKey = `audios/${albumName}/${COVER_FILENAME}`;

    try {
        console.log(`\nProcessing cover: [${albumName}] ${coverPath}`);

        await ossClient.put(ossKey, coverPath, {
            headers: { 'x-oss-object-acl': 'public-read' }
        });

        const coverUrl = `${publicBase}/${encodePathSegments(ossKey)}?v=2`;
        console.log(`   🖼️ Uploaded V2 Cover: ${coverUrl}`);

        const { error, count } = await supabase
            .from('audios')
            .update({ cover_url: coverUrl })
            .eq('album', albumName)
            .select('id', { count: 'exact', head: true });

        if (error) {
            console.error('   ❌ DB Error:', error.message);
            return;
        }

        console.log(`   ✨ DB Updated: ${count || 0} rows`);
    } catch (err) {
        console.error(`   ❌ Failed: [${albumName}]`, err && err.message ? err.message : err);
    }
}

main();
