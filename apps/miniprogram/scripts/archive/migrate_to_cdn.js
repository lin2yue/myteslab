const fs = require('fs');
const path = require('path');
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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const OLD_DOMAIN = 'https://lock-sounds.oss-cn-beijing.aliyuncs.com';
const NEW_DOMAIN = 'https://cdn.tewan.club';

async function main() {
    console.log('🚀 Starting Data Migration (OSS -> CDN)...');

    // 1. Migrate Audios table
    const { data: audios, error } = await supabase.from('audios').select('*');
    if (error) {
        console.error('❌ Error fetching audios:', error);
        return;
    }

    console.log(`📦 Found ${audios.length} audio records.`);
    let upCount = 0;

    for (const audio of audios) {
        let updates = {};
        if (audio.file_url && audio.file_url.startsWith(OLD_DOMAIN)) {
            updates.file_url = audio.file_url.replace(OLD_DOMAIN, NEW_DOMAIN);
        }
        if (audio.cover_url && audio.cover_url.startsWith(OLD_DOMAIN)) {
            updates.cover_url = audio.cover_url.replace(OLD_DOMAIN, NEW_DOMAIN);
        }

        if (Object.keys(updates).length > 0) {
            const { error: upErr } = await supabase
                .from('audios')
                .update(updates)
                .eq('id', audio.id);

            if (upErr) console.error(`   ❌ Failed to update ID ${audio.id}:`, upErr);
            else {
                console.log(`   ✅ Updated ID ${audio.id}`);
                upCount++;
            }
        }
    }
    console.log(`🎉 Updated ${upCount} audio records.`);

    // 2. Migrate Banners (if exists)
    // We try to fetch banners, if table doesn't exist it will error but that's fine.
    try {
        const { data: banners, error: bErr } = await supabase.from('banners').select('*');
        if (!bErr && banners) {
            console.log(`\n📦 Found ${banners.length} banner records.`);
            let bUpCount = 0;
            for (const b of banners) {
                if (b.image_url && b.image_url.startsWith(OLD_DOMAIN)) {
                    const newUrl = b.image_url.replace(OLD_DOMAIN, NEW_DOMAIN);
                    await supabase.from('banners').update({ image_url: newUrl }).eq('id', b.id);
                    console.log(`   ✅ Updated Banner ID ${b.id}`);
                    bUpCount++;
                }
            }
            console.log(`🎉 Updated ${bUpCount} banner records.`);
        }
    } catch (e) {
        console.log('No banners table or permission issue, skipping.');
    }
}

main();
