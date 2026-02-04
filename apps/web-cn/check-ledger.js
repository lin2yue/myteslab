const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://yuimiqsbfzhmbuvkieyp.supabase.co';
const supabaseKey = 'sb_secret_9Y4d1DthkuMDpZ6MCTtZyg_1-nkakMX';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Checking credit_ledger for recent top-ups...');
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('*')
    .eq('type', 'top-up')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Ledger Error:', error);
  } else {
    console.log('Recent top-ups:', JSON.stringify(data, null, 2));
  }
}
run();
