const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function main() {
    const { data: models } = await supabase.from('wrap_models').select('id, slug, name');

    for (const model of models) {
        const { count, error } = await supabase
            .from('wrap_model_map')
            .select('*', { count: 'exact', head: true })
            .eq('model_id', model.id);

        console.log(`[${model.slug}] ${model.name}: ${count} wraps mapped`);
    }
}
main();
