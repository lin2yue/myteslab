const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from apps/web/.env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWraps() {
    console.log('--- Checking for AI generated wraps ---');
    const { data, error } = await supabase
        .from('wraps')
        .select('id, name, prompt, category, created_at')
        .eq('category', 'ai_generated')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching wraps:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No community wraps found.');
        return;
    }

    data.forEach((wrap, i) => {
        console.log(`- Wrap ${i + 1}: ${wrap.name} (${wrap.created_at}) [Prompt: ${wrap.prompt ? wrap.prompt.substring(0, 30) : 'None'}]`);
    });
}

checkWraps();
