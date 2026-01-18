const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const repoRoot = path.resolve(__dirname, '..');
const loadEnvFileIfPresent = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (!key || process.env[key]) continue;
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
};
loadEnvFileIfPresent(path.join(repoRoot, '.env'));
loadEnvFileIfPresent(path.join(repoRoot, '.env.local'));

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("Updating 'Model 3' to 'model-3'...");
    const { data, error } = await s
        .from('wrap_models')
        .update({ slug: 'model-3' })
        .eq('slug', 'Model 3')
        .select();

    if (error) console.error(error);
    else console.log('Update success:', data);

    // Also update Model 3 2024+ to be safe? The user only complained about homepage (Model 3)
    // but consistent naming is better. Let's stick to the plan first.
}

run();
