const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '../../..');
const loadEnvFileIfPresent = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
            const value = values.join('=').trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = value;
        }
    }
};

loadEnvFileIfPresent(path.join(repoRoot, '.env.local'));
loadEnvFileIfPresent(path.join(repoRoot, 'apps/web/.env.local'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkModels() {
    const { data, error } = await supabase.from('wrap_models').select('slug, model_3d_url');
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Current DB Models:');
    data.forEach(m => console.log(`${m.slug}: ${m.model_3d_url}`));
}

checkModels();
