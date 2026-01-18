const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data, error } = await supabase
        .from('wrap_models')
        .select('*')
        .eq('is_active', true);

    if (error) console.error(error);
    else {
        console.log("Active Models:");
        data.forEach(m => console.log(`- [${m.slug}] ${m.name} (ID: ${m.id})`));
    }
}
main();
