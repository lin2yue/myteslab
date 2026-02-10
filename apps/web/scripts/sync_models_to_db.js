
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Path to env file (supports command line arg)
const envFile = process.argv[2] || '.env.local';
const envPath = path.resolve(__dirname, '..', envFile);
console.log('Loading environment from:', envPath);

if (!fs.existsSync(envPath)) {
    console.error(`Error: Environment file ${envFile} not found.`);
    process.exit(1);
}

dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// Priority: Service Role > Anon
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey ? (process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE (Preferred)' : 'ANON') : 'MISSING');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_MODELS = [
    {
        slug: 'cybertruck',
        name: 'Cybertruck',
        name_en: 'Cybertruck',
        model_3d_url: 'https://cdn.tewan.club/models/cybertruck/body.glb',
        wheel_url: 'https://cdn.tewan.club/models/wheels/cybertruck_wheels.glb',
        sort_order: 1,
        is_active: true
    },
    {
        slug: 'model-3',
        name: 'Model 3',
        name_en: 'Model 3 (Classic)',
        model_3d_url: 'https://cdn.tewan.club/models/model3/body.glb',
        wheel_url: 'https://cdn.tewan.club/models/wheels/stiletto.glb',
        sort_order: 2,
        is_active: true
    },
    {
        slug: 'model-3-2024',
        name: 'Model 3 焕新版',
        name_en: 'Model 3 Highland',
        model_3d_url: 'https://cdn.tewan.club/models/model3-2024-base/body.glb',
        wheel_url: 'https://cdn.tewan.club/models/wheels/induction.glb',
        sort_order: 3,
        is_active: true
    },
    {
        slug: 'model-y',
        name: 'Model Y',
        name_en: 'Model Y (Classic)',
        model_3d_url: 'https://cdn.tewan.club/models/modely/body.glb',
        wheel_url: 'https://cdn.tewan.club/models/wheels/induction.glb',
        sort_order: 4,
        is_active: true
    },
    {
        slug: 'model-y-2025-standard',
        name: 'Model Y 基础版',
        name_en: 'Model Y Juniper',
        model_3d_url: 'https://cdn.tewan.club/models/modely-2025-base/body.glb',
        wheel_url: 'https://cdn.tewan.club/models/wheels/induction.glb',
        sort_order: 5,
        is_active: true
    },
    {
        slug: 'modely-l',
        name: 'Model Y L',
        name_en: 'Model Y L',
        model_3d_url: 'https://cdn.tewan.club/models/modely-l/body.glb',
        wheel_url: 'https://cdn.tewan.club/models/wheels/modely-l_wheels.glb',
        sort_order: 6,
        is_active: true
    },
    {
        slug: 'model-3-2024-performance',
        name: 'Model 3 焕新版 (Performance)',
        name_en: 'Model 3 Highland Performance',
        model_3d_url: 'https://cdn.tewan.club/models/model3-2024-performance/body.glb',
        wheel_url: 'https://cdn.tewan.club/models/wheels/induction.glb',
        sort_order: 7,
        is_active: true
    },
    {
        slug: 'model-y-2025-performance',
        name: 'Model Y 焕新版 (Performance)',
        name_en: 'Model Y Juniper Performance',
        model_3d_url: 'https://cdn.tewan.club/models/modely-2025-performance/body.glb',
        wheel_url: 'https://cdn.tewan.club/models/wheels/induction.glb',
        sort_order: 8,
        is_active: true
    },
    {
        slug: 'model-y-2025-premium',
        name: 'Model Y 焕新版',
        name_en: 'Model Y Juniper Premium',
        model_3d_url: 'https://cdn.tewan.club/models/modely-2025-premium/body.glb',
        wheel_url: 'https://cdn.tewan.club/models/wheels/induction.glb',
        sort_order: 9,
        is_active: true
    }
];

async function syncModels() {
    console.log('--- Starting Model Synchronization ---');

    for (const model of DEFAULT_MODELS) {
        console.log(`Upserting model: ${model.slug}...`);

        const { error } = await supabase
            .from('wrap_models')
            .upsert({
                slug: model.slug,
                name: model.name,
                name_en: model.name_en,
                model_3d_url: model.model_3d_url,
                wheel_url: model.wheel_url,
                sort_order: model.sort_order,
                is_active: model.is_active,
                updated_at: new Date().toISOString()
            }, { onConflict: 'slug' });

        if (error) {
            console.error(`Error upserting ${model.slug}:`, error);
        } else {
            console.log(`Successfully synced ${model.slug}`);
        }
    }

    console.log('--- Sync Completed ---');
}

syncModels();
