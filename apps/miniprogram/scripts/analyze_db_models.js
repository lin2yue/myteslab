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

const CANONICAL_MODELS = [
    'cybertruck',
    'model-3',
    'model-3-2024-plus',
    'model-y-pre-2025',
    'model-y-2025-plus'
];

async function analyzeModels() {
    console.log('--- Analyzing Wrap Models ---');
    const { data: models, error } = await supabase
        .from('wrap_models')
        .select('*');

    if (error) {
        console.error('Error fetching models:', error);
        return;
    }

    for (const model of models) {
        const isCanonical = CANONICAL_MODELS.includes(model.slug);
        const status = isCanonical ? '✅ KEEP' : '⚠️  OBSOLETE';
        console.log(`${status} | Slug: ${model.slug.padEnd(20)} | Active: ${model.is_active} | URL: ${model.model_3d_url}`);
    }
}

analyzeModels();
