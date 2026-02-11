const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    console.log(`Loading env from ${envPath}`);
    dotenv.config({ path: envPath });
} else {
    const prodEnvPath = path.resolve(__dirname, '../.env.prod');
    if (fs.existsSync(prodEnvPath)) {
        console.log(`Loading env from ${prodEnvPath}`);
        dotenv.config({ path: prodEnvPath });
    }
}

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

async function run() {
    try {
        console.log('Querying webhook_events...');
        const res = await pool.query('SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 5');
        console.log('--- Webhook Logs ---');
        if (res.rows.length === 0) {
            console.log('NO LOGS FOUND. The webhook was never reached.');
        } else {
            console.table(res.rows);
            // Print full payload for the latest one
            if (res.rows[0]) {
                console.log('Latest Payload:', JSON.stringify(res.rows[0].payload, null, 2));
                console.log('Latest Error:', res.rows[0].error);
            }
        }
    } catch (err) {
        console.error('Error querying logs:', err);
    } finally {
        await pool.end();
    }
}

run();
