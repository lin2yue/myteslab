const path = require('path');
const fs = require('fs');
const glob = require('glob');
const OSS = require('ali-oss');

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

const OSS_CONFIG = {
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET || 'lock-sounds'
};

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
const SOURCE_DIR = path.resolve(__dirname, '../uploads/assets/wraps/tesla-examples');
const TARGET_PREFIX = 'wraps/tesla-examples';

const required = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
}

if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Folder not found: ${SOURCE_DIR}`);
    process.exit(1);
}

const files = glob.sync(path.join(SOURCE_DIR, '*.png'));

if (files.length === 0) {
    console.error('No wrap png files found in uploads/assets/wraps/tesla-examples');
    process.exit(1);
}

const client = new OSS(OSS_CONFIG);

async function uploadFile(filePath) {
    const filename = path.basename(filePath);
    const ossKey = `${TARGET_PREFIX}/${filename}`;

    await client.put(ossKey, filePath);

    const url = `${publicBase}/${encodePathSegments(ossKey)}`;
    return { filename, url };
}

async function main() {
    console.log(`Uploading ${files.length} wraps...`);

    for (const filePath of files) {
        const { filename, url } = await uploadFile(filePath);
        console.log(`${filename} -> ${url}`);
    }

    console.log('Done.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
