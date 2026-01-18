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

async function copyMappings(sourceSlug, targetSlug) {
    console.log(`--- Copying mappings from [${sourceSlug}] to [${targetSlug}] ---`);

    // Get Model IDs
    const { data: sourceModel } = await supabase.from('wrap_models').select('id').eq('slug', sourceSlug).single();
    const { data: targetModel } = await supabase.from('wrap_models').select('id').eq('slug', targetSlug).single();

    if (!sourceModel || !targetModel) {
        console.error(`Missing model: Source=${!!sourceModel}, Target=${!!targetModel}`);
        return;
    }

    // Get Source Mappings
    const { data: mappings } = await supabase.from('wrap_model_map').select('wrap_id').eq('model_id', sourceModel.id);

    if (!mappings || mappings.length === 0) {
        console.log(`No mappings found for source ${sourceSlug}`);
        return;
    }

    console.log(`Found ${mappings.length} mappings for source.`);

    // Insert for Target
    const newMappings = mappings.map(m => ({
        model_id: targetModel.id,
        wrap_id: m.wrap_id
    }));

    const { error } = await supabase.from('wrap_model_map').upsert(newMappings, { onConflict: 'model_id, wrap_id' });

    if (error) console.error("Error upserting:", error.message);
    else console.log(`✅ Upserted ${newMappings.length} mappings to ${targetSlug}`);
}

async function main() {
    await copyMappings('model-3-highland', 'model-3-legacy');
    // Using model-y-2025-premium as source for Y since regular 'model-y' might be old/wrong, 
    // but check_mappings showed 'model-y' also has 20. I'll use 2025-premium as it seems more recent.
    await copyMappings('model-y-2025-premium', 'model-y-legacy');
    await copyMappings('model-y-2025-premium', 'model-y-juniper');
    await copyMappings('model-y-2025-premium', 'cybertruck');
}

main();
