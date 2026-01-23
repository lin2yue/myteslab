const { createClient } = require('@supabase/supabase-js');
const OSS = require('ali-oss');
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

const CDN_DOMAIN = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club';

async function migrateBase64ToOSS() {
    console.log('Fetching wraps with base64 data URLs from DB...');

    // 查找所有包含 base64 的记录
    const { data: wraps, error } = await supabase
        .from('wraps')
        .select('*')
        .or('texture_url.like.data:image/%,preview_url.like.data:image/%')
        .is('deleted_at', null);

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    console.log(`Found ${wraps.length} wraps with base64 data to migrate.`);

    let successCount = 0;
    let failCount = 0;

    for (const wrap of wraps) {
        console.log(`\nProcessing wrap ${wrap.id} (${wrap.name})...`);
        let updateFields = {};

        // 迁移 texture_url
        if (wrap.texture_url && wrap.texture_url.startsWith('data:image/')) {
            try {
                console.log(`  Converting texture from base64...`);

                // 提取 base64 数据
                const matches = wrap.texture_url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (!matches) {
                    console.warn(`  Invalid base64 format for texture_url`);
                    continue;
                }

                const mimeType = matches[1];
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');

                // 生成文件名
                const ext = mimeType.split('/')[1] || 'png';
                const filename = `migrated-${wrap.id.substring(0, 8)}-${Date.now()}.${ext}`;

                // 上传到 OSS
                console.log(`  Uploading texture as ${filename}...`);
                const ossKey = `wraps/ai-generated/${filename}`;
                await ossClient.put(ossKey, buffer);

                const newUrl = `${CDN_DOMAIN}/${ossKey}`;
                updateFields.texture_url = newUrl;
                console.log(`  ✓ Texture uploaded: ${newUrl}`);

            } catch (err) {
                console.error(`  ✗ Failed to migrate texture:`, err.message);
                failCount++;
                continue;
            }
        }

        // 迁移 preview_url
        if (wrap.preview_url && wrap.preview_url.startsWith('data:image/')) {
            try {
                console.log(`  Converting preview from base64...`);

                // 提取 base64 数据
                const matches = wrap.preview_url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (!matches) {
                    console.warn(`  Invalid base64 format for preview_url`);
                    continue;
                }

                const mimeType = matches[1];
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');

                // 生成文件名
                const ext = mimeType.split('/')[1] || 'png';
                const filename = `preview-${wrap.id.substring(0, 8)}-${Date.now()}.${ext}`;

                // 上传到 OSS
                console.log(`  Uploading preview as ${filename}...`);
                const ossKey = `wraps/previews/${filename}`;
                await ossClient.put(ossKey, buffer);

                const newUrl = `${CDN_DOMAIN}/${ossKey}`;
                updateFields.preview_url = newUrl;
                console.log(`  ✓ Preview uploaded: ${newUrl}`);

            } catch (err) {
                console.error(`  ✗ Failed to migrate preview:`, err.message);
                failCount++;
                continue;
            }
        }

        // 更新数据库
        if (Object.keys(updateFields).length > 0) {
            const { error: updateError } = await supabase
                .from('wraps')
                .update(updateFields)
                .eq('id', wrap.id);

            if (updateError) {
                console.error(`  ✗ Update Error for ${wrap.id}:`, updateError);
                failCount++;
            } else {
                console.log(`  ✓ Successfully migrated ${wrap.id}`);
                successCount++;
            }
        }
    }

    console.log(`\n========================================`);
    console.log(`Migration completed!`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total: ${wraps.length}`);
    console.log(`========================================`);
}

migrateBase64ToOSS().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
