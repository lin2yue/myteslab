const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Try to load .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env.production') });
dotenv.config();

async function testConnectivity() {
    console.log('--- 1. Testing Gemini API Connectivity ---');
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
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("Say 'Connectivity OK'");
            const response = await result.response;
            console.log('✅ Gemini API Response:', response.text());
        } catch (err) {
            console.error('❌ Gemini API Error:', err.message);
            if (err.message.includes('fetch failed')) {
                console.error('👉 Suggestion: This is likely a network issue. Ensure your ECS can reach Gemini API (may need a proxy in China).');
            }
        }
    }

    console.log('\n--- 2. Checking Database Model Slugs ---');
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ DATABASE_URL is not set');
    } else {
        const client = new Client({ connectionString: dbUrl });
        try {
            await client.connect();
            const res = await client.query('SELECT slug, name, is_active FROM wrap_models');
            console.log('Database Slugs:');
            res.rows.forEach(row => {
                console.log(` - [${row.slug}] ${row.name} (Active: ${row.is_active})`);
            });

            const hardcoded = ['cybertruck', 'model-3', 'model-3-2024-plus', 'model-y-pre-2025', 'model-y-2025-plus'];
            const missing = res.rows.filter(r => r.is_active && !hardcoded.includes(r.slug.toLowerCase()));
            if (missing.length > 0) {
                console.warn('\n⚠️ Warning: The following active models are NOT in the API whitelist:');
                missing.forEach(m => console.log(` - ${m.slug}`));
            } else {
                console.log('\n✅ All database models are in the API whitelist.');
            }
        } catch (err) {
            console.error('❌ Database Error:', err.message);
        } finally {
            await client.end();
        }
    }
}

testConnectivity();
