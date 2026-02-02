const { createClient } = require('@supabase/supabase-js');

// Manual env for reliability in script
const supabaseUrl = 'https://yuimiqsbfzhmbuvkieyp.supabase.co';
const supabaseKey = 'sb_secret_9Y4d1DthkuMDpZ6MCTtZyg_1-nkakMX';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying webhook_logs...');
  const { data, error } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.error('Query Error:', error);
  } else {
    console.log('Results:', JSON.stringify(data, null, 2));
  }
}
run();
