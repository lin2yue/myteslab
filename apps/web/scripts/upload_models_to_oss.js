
const OSS = require('ali-oss');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
const envFile = process.argv[2] || '.env.local';
const envPath = path.resolve(__dirname, '..', envFile);
console.log('Loading environment from:', envPath);

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.warn(`Warning: Environment file ${envFile} not found.`);
}

// OSS Configuration
const client = new OSS({
    region: process.env.OSS_REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    secure: true
});

const MODELS_DIR = path.resolve(__dirname, '../public/models');
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club';

async function uploadFile(localPath, ossPath) {
    try {
        console.log(`Uploading ${localPath} -> ${ossPath}...`);
        await client.put(ossPath, localPath);
        console.log(`✅ Uploaded: ${CDN_URL}/${ossPath}`);
        return `${CDN_URL}/${ossPath}`;
    } catch (e) {
        console.error(`❌ Failed to upload ${localPath}:`, e);
        throw e;
    }
}

async function uploadDirectory(dir, prefix = 'models') {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (file.startsWith('.')) continue; // Skip dotfiles

        if (stat.isDirectory()) {
            await uploadDirectory(fullPath, `${prefix}/${file}`);
        } else {
            const ossPath = `${prefix}/${file}`;
            await uploadFile(fullPath, ossPath);
        }
    }
}

async function main() {
    console.log('--- Starting Model Migration to OSS ---');
    console.log(`Local Directory: ${MODELS_DIR}`);
    console.log(`Target Bucket: ${process.env.OSS_BUCKET}`);
    console.log(`CDN Domain: ${CDN_URL}`);

    if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_BUCKET) {
        console.error('Error: Missing OSS configuration. Check .env.local');
        process.exit(1);
    }

    try {
        await uploadDirectory(MODELS_DIR);
        console.log('--- Migration Completed Successfully ---');
    } catch (e) {
        console.error('--- Migration Failed ---', e);
        process.exit(1);
    }
}

main();
