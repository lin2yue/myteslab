const { createClient } = require('@supabase/supabase-js');

// User credentials
const supabaseUrl = 'https://eysiovvlutxhgnnydedr.supabase.co';
const supabaseKey = 'sb_publishable_Lf8-OhxRZcwcDhTqUOpbBA_JxoM7zt5';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("Checking Supabase connection...");
    const { data, error } = await supabase
        .from('audios')
        .select('*');

    if (error) {
        console.error("Error connecting:", error);
    } else {
        console.log("Connection Successful!");
        console.log("Row count:", data.length);
        if (data.length > 0) {
            console.log("Data found:");
            console.log(data);
        } else {
            console.log("Table is empty.");
        }
    }
}

checkData();
