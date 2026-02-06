
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local
const envFile = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envFile)) {
    console.log('Loading .env.local from:', envFile);
    const envConfig = dotenv.parse(fs.readFileSync(envFile));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} else {
    console.error('.env.local not found at:', envFile);
}

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSLMODE === 'require'
            ? { rejectUnauthorized: false }
            : false
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const sqlFile = path.resolve(__dirname, '../database/add_wechat_mp.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        console.log('Running SQL...');
        await client.query(sql);
        console.log('SQL executed successfully');
    } catch (err) {
        console.error('Error executing SQL:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
