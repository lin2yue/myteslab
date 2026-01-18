const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const repoRoot = path.resolve(__dirname, '..');

// Helper to load env files
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

const getSupabaseAdmin = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
        return null;
    }
    return createClient(url, key);
};

async function main() {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    // Simulate homepage load: Default is usually 'Model 3'
    console.log('Fetching model-3...');
    const { data: model, error: modelError } = await supabase
        .from('wrap_models')
        .select('id')
        .eq('slug', 'model-3')
        .single();

    if (modelError || !model) {
        console.error('Error fetching Model 3:', modelError);
        return;
    }

    console.log(`Model 3 ID: ${model.id}`);

    // Fetch wraps for this model
    // Logic from wraps.js: fetchWrap mappings -> fetchWraps
    const { data: mappings } = await supabase
        .from('wrap_model_map')
        .select('wrap_id')
        .eq('model_id', model.id);

    const wrapIds = (mappings || []).map(m => m.wrap_id);
    console.log(`Found ${wrapIds.length} wraps mapped to Model 3.`);

    if (wrapIds.length === 0) return;

    const { data: wraps, error: wrapsError } = await supabase
        .from('wraps')
        .select('id, name, slug, preview_image_url, sort_order, created_at')
        .in('id', wrapIds)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (wrapsError) {
        console.error(wrapsError);
        return;
    }

    console.log('\n--- Homepage Wraps Data ---');
    wraps.forEach((w, i) => {
        console.log(`[${i}] ${w.name}`);
        console.log(`    Slug: ${w.slug}`);
        console.log(`    Preview URL: ${w.preview_image_url}`);
        // Simple heuristic check
        if (!w.preview_image_url) console.log('    ⚠️  MISSING URL');
        else if (w.preview_image_url.includes('cdn.tewan.club')) console.log('    ✅ ON CDN');
        else console.log('    ❓ OTHER DOMAIN');
    });
}

main().catch(console.error);
