
const OSS = require('ali-oss');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
try {
    const envPath = path.join(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)$/);
            if (match) {
                const key = match[1];
                let value = match[2].trim();
                // Remove quotes
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                process.env[key] = value;
            }
        });
        console.log('✅ Loaded .env.local');
    }
} catch (e) {
    console.error('Failed to load .env.local:', e.message);
}

async function testGeminiUrl() {
    console.log('--- Testing Gemini Signed URL Fetching ---');

    // 1. Setup OSS Client
    const config = {
        region: process.env.OSS_REGION || 'oss-cn-beijing',
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: process.env.OSS_BUCKET || 'lock-sounds',
    };

    if (!config.accessKeyId) {
        console.error('❌ OSS Credentials missing');
        return;
    }

    const client = new OSS({
        ...config,
        secure: true
    });
    const key = 'masks/cybertruck_mask.png'; // Sample existng file

    // Generate signed URL (10 mins)
    const signedUrl = client.signatureUrl(key, { expires: 600 });
    console.log('✅ Generated Signed URL:', signedUrl);

    // 2. Setup Gemini Call
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY missing');
        return;
    }

    const apiBaseUrl = process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com';
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';
    const url = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${apiKey}`;

    console.log(`Connecting to: ${url}`);

    const payload = {
        contents: [{
            role: 'user',
            parts: [
                { text: "Describe this image in one word." },
                {
                    file_data: {
                        mime_type: "image/png",
                        file_uri: signedUrl
                    }
                }
            ]
        }],
        generationConfig: {
            maxOutputTokens: 10
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok) {
            console.log('✅ Gemini Success:', JSON.stringify(data, null, 2));
        } else {
            console.error(`❌ Gemini Error (${response.status}):`, JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('❌ Request Failed:', err.message);
    }
}

testGeminiUrl();
