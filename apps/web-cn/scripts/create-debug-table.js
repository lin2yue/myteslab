
const { Client } = require('pg');
require('dotenv').config({ path: '../.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log('Connected to database.');
        await client.query(`
            CREATE TABLE IF NOT EXISTS debug_logs (
                id SERIAL PRIMARY KEY,
                category TEXT,
                message TEXT,
                data JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('Table debug_logs created/verified.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
