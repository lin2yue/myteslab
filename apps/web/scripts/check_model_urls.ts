import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkModelUrls() {
    console.log('🔍 Checking wrap_models table in production database...\n');

    const { data, error } = await supabase
        .from('wrap_models')
        .select('slug, name, model_3d_url, is_active')
        .order('sort_order');

    if (error) {
        console.error('❌ Error fetching models:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('⚠️  No models found in database');
        return;
    }

    console.log(`✅ Found ${data.length} models:\n`);

    data.forEach((model) => {
        console.log(`Model: ${model.name} (${model.slug})`);
        console.log(`  Active: ${model.is_active}`);
        console.log(`  URL: ${model.model_3d_url}`);
        console.log('');
    });

    // Test if URLs are accessible
    console.log('\n🌐 Testing URL accessibility...\n');

    for (const model of data) {
        try {
            const response = await fetch(model.model_3d_url, { method: 'HEAD' });
            const status = response.ok ? '✅' : '❌';
            console.log(`${status} ${model.slug}: ${response.status} ${response.statusText}`);
            console.log(`   ${model.model_3d_url}`);
        } catch (err) {
            console.log(`❌ ${model.slug}: Network error`);
            console.log(`   ${model.model_3d_url}`);
            console.log(`   Error: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

checkModelUrls().catch(console.error);
