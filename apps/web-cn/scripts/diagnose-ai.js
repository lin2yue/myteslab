const dotenv = require('dotenv');
const path = require('path');

// Try to load .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env.production') });
dotenv.config();

async function testConnectivity() {
    console.log('--- 1. Testing Gemini API Connectivity (via Fetch) ---');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY is not set in environment');
    } else {
        console.log(`Using API Key: ${apiKey.substring(0, 8)}...`);

        // Proxy check
        if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
            console.log(`Proxy detected: HTTPS_PROXY=${process.env.HTTPS_PROXY}, HTTP_PROXY=${process.env.HTTP_PROXY}`);
        }

        try {
            const MODEL = 'gemini-1.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

            console.log(`Connecting to: https://generativelanguage.googleapis.com/...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Say 'Connectivity OK'" }] }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                console.log('✅ Gemini API Response:', text || 'Empty response but OK');
            } else {
                const errText = await response.text();
                console.error(`❌ Gemini API Error (${response.status}):`, errText);
            }
        } catch (err) {
            console.error('❌ Connectivity Error:', err.message);
            if (err.message.includes('fetch failed')) {
                console.error('👉 Suggestion: This is a network issue. Ensure your ECS can reach Google APIs.');
            }
        }
    }

    console.log('\n--- 2. Checking Database Model Slugs ---');
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ DATABASE_URL is not set');
    } else {
        try {
            const { Client } = require('pg');
            const client = new Client({ connectionString: dbUrl });
            await client.connect();
            const res = await client.query('SELECT slug, name, is_active FROM wrap_models');
            console.log('Database Slugs:');
            res.rows.forEach(row => {
                console.log(` - [${row.slug}] ${row.name} (Active: ${row.is_active})`);
            });
            await client.end();
        } catch (err) {
            console.error('❌ Database Check Skipped or Failed:', err.message);
        }
    }
}

testConnectivity();
