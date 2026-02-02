const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLogs() {
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching logs:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No logs found in webhook_logs table.');
    return;
  }

  console.log('--- Webhook Logs Found: ' + data.length + ' ---');
  data.forEach(log => {
      console.log(`[${log.created_at}] ${log.event_type} - ${log.status} | Error: ${log.error_msg || 'None'}`);
      if (log.status !== 'success') {
          // console.log('Payload snippet:', JSON.stringify(log.payload).substring(0, 200));
      }
  });
}

checkLogs();
