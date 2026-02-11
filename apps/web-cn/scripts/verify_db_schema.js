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

async function run() {
    try {
        console.log('--- Checking Tables ---');
        const tablesRes = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('credit_ledger', 'webhook_events', 'credit_logs')
        `);
        console.table(tablesRes.rows);

        console.log('\n--- Checking credit_ledger Columns ---');
        if (tablesRes.rows.some(r => r.table_name === 'credit_ledger')) {
            const columnsRes = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'credit_ledger'
            `);
            console.table(columnsRes.rows);

            console.log('\n--- Testing Query Execution ---');
            try {
                // Test the exact query used in code
                const testRes = await pool.query(`SELECT * FROM credit_ledger WHERE metadata->>'transaction_id' = 'test'`);
                console.log('Query successful. Rows:', testRes.rowCount);
            } catch (qErr) {
                console.error('QUERY FAILED:', qErr.message);
            }
        } else {
            console.error('CRITICAL: credit_ledger table DOES NOT EXIST.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
