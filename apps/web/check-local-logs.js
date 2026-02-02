const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('Checking local logs (yuimiqsbfzhmbuvkieyp)...');
  const { data, error } = await supabase.from('webhook_logs').select('*').limit(5);
  if (error) {
    if (error.code === 'PGRST204' || error.message.includes('not found')) {
      console.log('Table webhook_logs does not exist locally.');
    } else {
      console.error('Error:', error);
    }
  } else {
    console.log('Local Logs:', JSON.stringify(data, null, 2));
  }
}
check();
