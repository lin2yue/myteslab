const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, 'apps/web/.env.local') });

async function checkColumn() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.log('Env variables not found');
        return;
    }
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('wraps').select('reference_images').limit(1);
    if (error) {
        console.log('Error or missing column:', error.message);
    } else {
        console.log('Column exists!');
    }
}

checkColumn();
