const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
};

loadEnvFileIfPresent(path.join(repoRoot, '.env'));
loadEnvFileIfPresent(path.join(repoRoot, '.env.local'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: models, error } = await supabase
        .from('wrap_models')
        .select('slug, name')
        .eq('is_active', true);

    if (error) {
        console.error(error);
        return;
    }

    console.log('--- DB Slugs ---');
    models.forEach(m => console.log(`Slug: ${m.slug}  | Name: ${m.name}`));
}

main();
