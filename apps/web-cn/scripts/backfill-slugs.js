const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillSlugs() {
    console.log('Starting slug backfill...');

    // 1. Fetch wraps with missing slugs
    const { data: wraps, error } = await supabase
        .from('wraps')
        .select('id')
        .is('slug', null);

    if (error) {
        console.error('Error fetching wraps:', error);
        return;
    }

    console.log(`Found ${wraps.length} wraps without slugs.`);

    // 2. Update each wrap
    let successCount = 0;
    let failCount = 0;

    for (const wrap of wraps) {
        const newSlug = crypto.randomBytes(6).toString('hex');
        const { error: updateError } = await supabase
            .from('wraps')
            .update({ slug: newSlug })
            .eq('id', wrap.id);

        if (updateError) {
            console.error(`Failed to update wrap ${wrap.id}:`, updateError);
            failCount++;
        } else {
            console.log(`Updated wrap ${wrap.id} with slug ${newSlug}`);
            successCount++;
        }
    }

    console.log(`Backfill complete. Success: ${successCount}, Failed: ${failCount}`);
}

backfillSlugs();
