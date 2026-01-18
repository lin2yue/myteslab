const { createClient } = require('@supabase/supabase-js');

// USE THE ANON KEY (Frontend Key), NOT the Service Role Key
const supabaseUrl = 'https://eysiovvlutxhgnnydedr.supabase.co';
const supabaseKey = 'sb_publishable_Lf8-OhxRZcwcDhTqUOpbBA_JxoM7zt5';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReadAccess() {
    console.log("🕵️ Testing Read Access with Anon Key...");

    // exact query used in services/audio.js (mostly)
    const { data, error } = await supabase
        .from('audios')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("❌ Read FAILED:", error.message);
        console.error("   Reason: Likely RLS (Row Level Security) policy is blocking public access.");
        console.error("   Fix: Add 'Enable read access for all users' policy in Supabase.");
    } else {
        console.log("✅ Read SUCCESS!");
        console.log(`   Fetched ${data.length} rows.`);
        if (data.length > 0) {
            console.log("   Sample:", data[0].title);
        } else {
            console.log("   ⚠️ Table is empty (or policy hides all rows).");
        }
    }
}

checkReadAccess();
