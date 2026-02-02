const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yuimiqsbfzhmbuvkieyp.supabase.co';
const supabaseKey = 'sb_secret_9Y4d1DthkuMDpZ6MCTtZyg_1-nkakMX';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- DB CHECK START ---');
  try {
    const { data, error } = await supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error('SQL Error:', error);
    } else if (!data || data.length === 0) {
      console.log('No entries found in webhook_logs.');
    } else {
      console.log(`Found ${data.length} logs.`);
      data.forEach(log => {
        console.log(`[${log.created_at}] Event: ${log.event_type} | Status: ${log.status} | Error: ${log.error_msg || 'None'}`);
      });
    }
  } catch (e) {
    console.error('Catastrophic failure:', e.message);
  }
  console.log('--- DB CHECK END ---');
}

run().then(() => {
  // Give it a tiny bit of time to flush console
  setTimeout(() => process.exit(0), 100);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
