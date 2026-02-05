const { Pool } = require('pg');

const connectionString = 'postgresql://tewan:crystal*2@pgm-2zeum4kehtj5049x2o.pg.rds.aliyuncs.com:5432/tewan_web_cn';

const pool = new Pool({
    connectionString,
});

async function runMigration() {
    console.log('🚀 Starting database migration (inline)...');

    try {
        const client = await pool.connect();
        console.log('✅ Connected to RDS.');

        await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS verification_token TEXT,
      ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMP WITH TIME ZONE;
      
      CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
    `);

        console.log('✅ Migration executed successfully!');

        const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('email_verified_at', 'verification_token')");
        console.log('Verified columns in users table:', res.rows.map(r => r.column_name));

        client.release();
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

runMigration();
