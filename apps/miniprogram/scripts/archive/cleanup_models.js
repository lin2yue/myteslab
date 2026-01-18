const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const fs = require('fs');

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

const KEEP_SLUGS = [
    'model-3-legacy',
    'model-3-highland',
    'model-y-legacy',
    'model-y-juniper',
    'cybertruck', // Keep Cybertruck just in case
    'cybertruck-site'
];

async function main() {
    console.log('--- Deactivating deprecated models ---');

    // 1. Get all active models
    const { data: models } = await supabase.from('wrap_models').select('slug, id, is_active').eq('is_active', true);

    for (const model of models) {
        if (!KEEP_SLUGS.includes(model.slug)) {
            console.log(`Deactivating: ${model.slug}`);
            await supabase.from('wrap_models').update({ is_active: false }).eq('id', model.id);
        } else {
            console.log(`Keeping: ${model.slug}`);
        }
    }
    console.log('--- Done ---');
}

main();
