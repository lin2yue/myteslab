const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('/Users/linpengfei/work/tesla-studio-monorepo/apps/web/.env.local', 'utf8');
const url = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function checkLogs() {
  const { data, error } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.error('Error fetching logs:', error.message);
  } else {
    console.log('--- Webhook Logs Found: ' + (data?.length || 0) + ' ---');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkLogs();
