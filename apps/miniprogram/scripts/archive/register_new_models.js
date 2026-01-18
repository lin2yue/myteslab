const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');

// Helper to load env
const loadEnvFileIfPresent = (filePath) => {
    const fsSync = require('fs');
    if (!fsSync.existsSync(filePath)) return;
    const text = fsSync.readFileSync(filePath, 'utf8');
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

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Derived from fetch_and_convert_models.js
const MODELS_TO_REGISTER = [
    { name: 'Model 3 (Pre-2024)', slug: 'model-3-legacy' },
    { name: 'Model 3 Highland', slug: 'model-3-highland' },
    { name: 'Model Y (Pre-2025)', slug: 'model-y-legacy' },
    { name: 'Model Y Juniper', slug: 'model-y-juniper' },
    { name: 'Cybertruck', slug: 'cybertruck' }
];

async function main() {
    console.log('--- Registering Models ---');

    for (const model of MODELS_TO_REGISTER) {
        // Upsert logic
        // Try to select first
        const { data: existing } = await supabase.from('wrap_models').select('id').eq('slug', model.slug).single();

        if (existing) {
            console.log(`✅ Exists: ${model.name} (${model.slug})`);
        } else {
            console.log(`✨ Creating: ${model.name} (${model.slug})`);
            const { error } = await supabase.from('wrap_models').insert({
                slug: model.slug,
                name: model.name,
                model_url: 'pending', // Legacy required field
                // created_at defaults to now
            });
            if (error) {
                console.error(`   ❌ Error creating ${model.slug}:`, error.message);
            }
        }
    }
    console.log('--- Registration Complete ---');
}

main();
