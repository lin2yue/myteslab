import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLatestCybertruck() {
    const { data, error } = await supabase
        .from('wraps')
        .select('*')
        .eq('model_slug', 'cybertruck')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('Latest 5 Cybertruck Wraps:');
    data.forEach(wrap => {
        console.log(`- ID: ${wrap.id}`);
        console.log(`  Prompt: ${wrap.prompt}`);
        console.log(`  Texture URL: ${wrap.texture_url}`);
        console.log(`  Created At: ${wrap.created_at}`);
        console.log('---');
    });
}

checkLatestCybertruck().catch(console.error);
