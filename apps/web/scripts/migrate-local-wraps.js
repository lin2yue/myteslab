const { createClient } = require('@supabase/supabase-js');
const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../../../.env.local');
console.log('Loading env from:', envPath);
require('dotenv').config({ path: envPath });

console.log('SUPABASE_URL present:', !!process.env.SUPABASE_URL);
console.log('OSS_ACCESS_KEY_ID present:', !!process.env.OSS_ACCESS_KEY_ID);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ossClient = new OSS({
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET || 'lock-sounds'
});

const CDN_DOMAIN = process.env.CDN_DOMAIN || 'https://cdn.tewan.club';

async function migrate() {
    console.log('Fetching local wraps from DB...');
    const { data: wraps, error } = await supabase
        .from('generated_wraps')
        .select('*')
        .or('texture_url.ilike.%/api/debug/assets%,preview_url.ilike.%/api/debug/assets%');

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    console.log(`Found ${wraps.length} wraps to migrate.`);

    for (const wrap of wraps) {
        console.log(`Processing wrap ${wrap.id}...`);
        let updateFields = {};

        // Migrate texture
        if (wrap.texture_url && wrap.texture_url.startsWith('/api/debug/assets')) {
            const fileName = new URLSearchParams(wrap.texture_url.split('?')[1]).get('file');
            const localPath = path.resolve(__dirname, '../../../dev-studio/generated-wraps', fileName);

            if (fs.existsSync(localPath)) {
                console.log(`  Uploading texture ${fileName}...`);
                const ossKey = `wraps/ai-generated/${fileName}`;
                await ossClient.put(ossKey, localPath);
                updateFields.texture_url = `${CDN_DOMAIN}/${ossKey}`;
            } else {
                console.warn(`  Local file not found: ${localPath}`);
            }
        }

        // Migrate preview
        if (wrap.preview_url && wrap.preview_url.startsWith('/api/debug/assets')) {
            const fileName = new URLSearchParams(wrap.preview_url.split('?')[1]).get('file');
            const localPath = path.resolve(__dirname, '../../../dev-studio/generated-wraps', fileName);

            if (fs.existsSync(localPath)) {
                console.log(`  Uploading preview ${fileName}...`);
                const ossKey = `wraps/previews/${fileName}`;
                await ossClient.put(ossKey, localPath);
                updateFields.preview_url = `${CDN_DOMAIN}/${ossKey}`;
            } else {
                console.warn(`  Local file not found: ${localPath}`);
            }
        }

        if (Object.keys(updateFields).length > 0) {
            const { error: updateError } = await supabase
                .from('generated_wraps')
                .update(updateFields)
                .eq('id', wrap.id);

            if (updateError) {
                console.error(`  Update Error for ${wrap.id}:`, updateError);
            } else {
                console.log(`  Successfully migrated ${wrap.id}`);
            }
        }
    }
}

migrate();
