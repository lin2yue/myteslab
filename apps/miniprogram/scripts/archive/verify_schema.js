const { createClient } = require('@supabase/supabase-js');
const { wxFetch } = require('../src/services/wx-fetch'); // We might not need this in node environment if we use standard fetch, but let's stick to standard node execution.
// In Node, fetch is available in newer versions or we might need to rely on the fact that supabase-js uses cross-fetch.
// Let's just use the standard client, verifying if selecting the new columns throws error.

const supabaseUrl = 'https://eysiovvlutxhgnnydedr.supabase.co';
const supabaseKey = 'sb_publishable_Lf8-OhxRZcwcDhTqUOpbBA_JxoM7zt5';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Verifying schema...");
    // Try to select the new columns
    const { data, error } = await supabase
        .from('audios')
        .select('id, cover_url, album, tags')
        .limit(1);

    if (error) {
        console.error("Schema verification failed (Columns might be missing):", error.message);
    } else {
        console.log("Schema verification successful! New columns detected.");
        if (data.length > 0) {
            console.log("Sample data:", data[0]);
        }
    }
}

checkSchema();
