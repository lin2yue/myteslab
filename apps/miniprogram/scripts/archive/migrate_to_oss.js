const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');

const loadEnv = (filePath) => {
    if (!fs.existsSync(filePath)) return {};
    const text = fs.readFileSync(filePath, 'utf8');
    const env = {};
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [k, ...v] = trimmed.split('=');
        if (k) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
    return env;
}

const env = { ...loadEnv(path.join(repoRoot, '.env')), ...loadEnv(path.join(repoRoot, '.env.local')) };
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const OLD_DOMAIN = 'http://lock-sounds.oss-cn-beijing.aliyuncs.com';
const NEW_DOMAIN = process.env.CDN_DOMAIN || 'https://cdn.tewan.club';

async function migrateTable(table, columns) {
    console.log(`Migrating ${table}...`);

    // Fetch all rows that use the old domain locally to avoid huge update hits if not needed
    // Limit to batch sizes if real prod, but fine for small set here
    const { data: rows, error } = await supabase.from(table).select(`id, ${columns.join(',')}`);
    if (error) {
        console.error(error);
        return;
    }

    let count = 0;
    for (const row of rows) {
        let updates = {};
        for (const col of columns) {
            if (row[col] && row[col].startsWith(OLD_DOMAIN)) {
                updates[col] = row[col].replace(OLD_DOMAIN, NEW_DOMAIN);
            }
        }

        if (Object.keys(updates).length > 0) {
            await supabase.from(table).update(updates).eq('id', row.id);
            count++;
        }
    }
    console.log(`Updated ${count} rows in ${table}`);
}

async function main() {
    console.log(`Migrating from ${OLD_DOMAIN} to ${NEW_DOMAIN}`);

    // wraps: image_url, preview_image_url
    await migrateTable('wraps', ['image_url', 'preview_image_url']);

    // wrap_models: model_3d_url
    await migrateTable('wrap_models', ['model_3d_url']);

    console.log('Migration done.');
}

main();
