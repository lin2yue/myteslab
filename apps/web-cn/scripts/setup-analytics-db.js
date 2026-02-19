const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
  });

  const sql = `
    CREATE TABLE IF NOT EXISTS public.site_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      pathname TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      ip_address TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_pathname ON site_analytics(pathname);
    CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON site_analytics(created_at DESC);
  `;

  try {
    console.log('Connecting to Aliyun RDS...');
    const client = await pool.connect();
    console.log('Connected. Running SQL...');
    await client.query(sql);
    console.log('✅ Table "site_analytics" created or already exists.');
    client.release();
  } catch (err) {
    console.error('❌ Error executing SQL:', err);
  } finally {
    await pool.end();
  }
}

main();
