const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    const prodEnvPath = path.resolve(__dirname, '../.env.prod');
    if (fs.existsSync(prodEnvPath)) {
        dotenv.config({ path: prodEnvPath });
    }
}

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

const TARGET_USER_ID = '7eb8fa9c-b76f-489f-9996-237733b89f78';

async function run() {
    try {
        console.log(`Checking credits for user: ${TARGET_USER_ID}`);

        // Check user_credits
        const creditsRes = await pool.query('SELECT * FROM user_credits WHERE user_id = $1', [TARGET_USER_ID]);
        console.log('--- user_credits ---');
        console.table(creditsRes.rows);

        // Check credit_ledger
        const ledgerRes = await pool.query('SELECT * FROM credit_ledger WHERE user_id = $1 ORDER BY created_at DESC', [TARGET_USER_ID]);
        console.log('--- credit_ledger ---');
        console.table(ledgerRes.rows);

    } catch (err) {
        console.error('Error querying DB:', err);
    } finally {
        await pool.end();
    }
}

run();
