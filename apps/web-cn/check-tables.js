const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://yuimiqsbfzhmbuvkieyp.supabase.co';
const supabaseKey = 'sb_secret_9Y4d1DthkuMDpZ6MCTtZyg_1-nkakMX';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Listing tables via information_schema...');
  const { data, error } = await supabase.rpc('get_tables'); // Generic RPC often doesn't exist
  
  // Try direct SQL via a dummy query that checks information_schema
  // Since I can't run arbitrary SQL easily with the client without an RPC, I'll just try to query another table to be safe.
  const { data: profiles, error: pError } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
  console.log('Profiles connection check:', pError || 'OK');
  
  const { data: logs, error: lError } = await supabase.from('webhook_logs').select('*').limit(1);
  console.log('Webhook_logs check:', lError || 'Found entries');
}
run();
