const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^"(.*)"$/, '$1');
    }
});

async function run() {
    const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        // 1. Find the user(s) named "微信用户"
        const findRes = await client.query("SELECT id FROM users WHERE display_name = '微信用户'");
        const userIds = findRes.rows.map(r => r.id);

        if (userIds.length === 0) {
            console.log('No user found with display_name "微信用户".');
            return;
        }

        console.log(`Found ${userIds.length} users:`, userIds);

        for (const userId of userIds) {
            console.log(`Deleting user: ${userId}`);
            // Delete in order to respect FK constraints
            await client.query("DELETE FROM user_credits WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM profiles WHERE id = $1", [userId]);
            await client.query("DELETE FROM user_identities WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM wechat_qr_sessions WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM users WHERE id = $1", [userId]);
            console.log(`User ${userId} deleted.`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
