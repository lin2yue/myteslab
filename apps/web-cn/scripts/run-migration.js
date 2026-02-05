const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://tewan:crystal*2@pgm-2zeum4kehtj5049x.pg.rds.aliyuncs.com:5432/tewan_web_cn';

const pool = new Pool({
    connectionString,
});

async function runMigration() {
    console.log('🚀 Starting database migration...');
    const sqlPath = path.join(__dirname, '../database/add_email_verification.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        const client = await pool.connect();
        console.log('✅ Connected to RDS.');

        await client.query(sql);
        console.log('✅ Migration executed successfully!');

        // Verify columns
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
