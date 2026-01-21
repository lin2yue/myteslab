const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const dotenv = require('dotenv');

// Load environment variables from root .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

async function uploadMasks() {
    const config = {
        region: process.env.OSS_REGION || 'oss-cn-beijing',
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: process.env.OSS_BUCKET || 'lock-sounds',
    };

    if (!config.accessKeyId || !config.accessKeySecret) {
        console.error('Error: OSS credentials missing in .env.local');
        process.exit(1);
    }

    const client = new OSS(config);
    const masksDir = path.join(__dirname, '../assets/masks');

    if (!fs.existsSync(masksDir)) {
        console.error('Error: assets/masks directory not found');
        process.exit(1);
    }

    const files = fs.readdirSync(masksDir).filter(f => f.endsWith('_mask.png'));
    console.log(`Found ${files.length} masks to upload...`);

    for (const file of files) {
        const filePath = path.join(masksDir, file);
        const ossKey = `masks/${file}`;

        try {
            console.log(`Uploading ${file} to ${ossKey}...`);
            await client.put(ossKey, filePath);
            console.log(`Successfully uploaded ${file}`);
        } catch (err) {
            console.error(`Failed to upload ${file}:`, err.message);
        }
    }

    console.log('\nAll masks processed.');
}

uploadMasks().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
