// Zero-dependency diagnostic script for AI connectivity
// Run with: node diagnose-ai.js
// Triggering deployment...

async function testConnectivity() {
    console.log('--- 1. Testing Gemini API Connectivity (Zero-Dep) ---');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY is not set in environment (process.env)');
        console.log('Available env keys:', Object.keys(process.env).filter(k => k.includes('API') || k.includes('KEY') || k.includes('PROXY')));
    } else {
        console.log(`Using API Key: ${apiKey.substring(0, 8)}...`);

        // Proxy check
        if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
            console.log(`Proxy detected: HTTPS_PROXY=${process.env.HTTPS_PROXY}, HTTP_PROXY=${process.env.HTTP_PROXY}`);
        }

        try {
            const MODEL = 'gemini-1.5-flash';
            const apiBaseUrl = process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com';
            const url = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

            console.log(`Connecting to: ${apiBaseUrl}...`);

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
                console.error(`❌ Gemini API Error (${response.status}):`, errText.substring(0, 500));
            }
        } catch (err) {
            console.error('❌ Connectivity Error:', err.message);
            if (err.message.includes('fetch failed')) {
                console.error('👉 Suggestion: This is a network issue. Ensure your ECS can reach Google APIs.');
            }
        }
    }

    console.log('\n--- 2. Environment Status ---');
    console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
    console.log('OSS_ACCESS_KEY_ID set:', !!process.env.OSS_ACCESS_KEY_ID);
    console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
}

testConnectivity();
