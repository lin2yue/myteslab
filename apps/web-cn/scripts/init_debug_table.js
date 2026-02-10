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
    // Try .env.prod if .env.local doesn't exist
    const prodEnvPath = path.resolve(__dirname, '../.env.prod');
    if (fs.existsSync(prodEnvPath)) {
        console.log(`Loading env from ${prodEnvPath}`);
        dotenv.config({ path: prodEnvPath });
    } else {
        console.warn('No .env file found, relying on process.env');
    }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('Error: DATABASE_URL not found in environment variables.');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

async function run() {
    try {
        const sqlPath = path.resolve(__dirname, '../database/debug_webhook.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL from:', sqlPath);
        await pool.query(sql);
        console.log('Successfully created webhook_events table.');
    } catch (err) {
        console.error('Error executing SQL:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
