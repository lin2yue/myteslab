const https = require('https');
const dns = require('dns');

const host = 'gemini.aievgo.com';

console.log(`--- 🔍 DNS Resolution for ${host} ---`);
dns.lookup(host, (err, address, family) => {
    if (err) {
        console.error('❌ DNS Lookup Failed:', err);
    } else {
        console.log(`✅ Address: ${address} (family: ${family})`);
    }

    console.log(`\n--- 🔍 HTTPS Connection to https://${host} ---`);
    const options = {
        hostname: host,
        port: 443,
        path: '/',
        method: 'GET',
        timeout: 10000
    };

    const req = https.request(options, (res) => {
        console.log(`✅ Response Status: ${res.statusCode}`);
        res.on('data', () => { });
    });

    req.on('error', (e) => {
        console.error('❌ Request Error:', e);
    });

    req.on('timeout', () => {
        console.error('❌ Request Timeout');
        req.destroy();
    });

    req.end();
});
