
const { Client } = require('pg');
require('dotenv').config({ path: '../.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        const res = await client.query('SELECT * FROM wechat_qr_sessions ORDER BY created_at DESC LIMIT 5');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
