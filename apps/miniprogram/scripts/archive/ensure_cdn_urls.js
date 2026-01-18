const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

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
const OLD_DOMAIN_HTTP = 'http://lock-sounds.oss-cn-beijing.aliyuncs.com';
const NEW_DOMAIN = 'https://cdn.tewan.club';

async function migrateTable(table, columns) {
    console.log(`\n📦 Migrating table: ${table}`);

    // Select all rows
    const { data: rows, error } = await supabase.from(table).select('*');
    if (error) {
        // Table might not exist or other error
        console.warn(`   ⚠️ Error accessing ${table}: ${error.message}`);
        return;
    }

    let count = 0;
    for (const row of rows) {
        let updates = {};
        for (const col of columns) {
            const val = row[col];
            if (typeof val === 'string') {
                if (val.startsWith(OLD_DOMAIN)) {
                    updates[col] = val.replace(OLD_DOMAIN, NEW_DOMAIN);
                } else if (val.startsWith(OLD_DOMAIN_HTTP)) {
                    updates[col] = val.replace(OLD_DOMAIN_HTTP, NEW_DOMAIN);
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            const { error: upErr } = await supabase.from(table).update(updates).eq('id', row.id);
            if (upErr) {
                console.error(`   ❌ Failed to update ID ${row.id}: ${upErr.message}`);
            } else {
                console.log(`   ✅ Updated ID ${row.id}`);
                count++;
            }
        }
    }
    console.log(`   🎉 Updated ${count} records in ${table}.`);
}

async function main() {
    console.log('🚀 Starting Data Migration (OSS -> CDN)...');

    // 1. Audios
    await migrateTable('audios', ['file_url', 'cover_url']);

    // 2. Banners
    await migrateTable('banners', ['image_url']);

    // 3. Wraps
    await migrateTable('wraps', ['image_url', 'preview_image_url']);

    // 4. Wrap Models
    await migrateTable('wrap_models', ['model_3d_url']);

    console.log('\n✨ Migration complete.');
}

main();
