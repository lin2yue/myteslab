const https = require('https');

const targets = [
    { name: 'Valentine (Broken?)', url: 'https://cdn.tewan.club/previews/wraps/Model%203-model-3-official-valentine-v1768421630345.png' },
    { name: 'Ani (Working?)', url: 'https://cdn.tewan.club/previews/wraps/Model%203-model-3-official-ani-v1768421656460.png' }
];

targets.forEach(t => {
    https.get(t.url, (res) => {
        const { statusCode } = res;
        const contentLength = res.headers['content-length'];
        const contentType = res.headers['content-type'];

        console.log(`\n--- ${t.name} ---`);
        console.log(`Status: ${statusCode}`);
        console.log(`Size: ${contentLength} bytes`);
        console.log(`Type: ${contentType}`);

        let captured = false;
        res.on('data', (chunk) => {
            if (!captured) {
                captured = true;
                // Check magic bytes for PNG: 89 50 4E 47 0D 0A 1A 0A
                const header = chunk.slice(0, 8).toString('hex').toUpperCase();
                console.log(`Magic Bytes: ${header}`);
                if (header === '89504E470D0A1A0A') {
                    console.log('✅ Valid PNG Signature');
                } else {
                    console.log('❌ Invalid Signature (Not a PNG)');
                    console.log('Initial text content:', chunk.slice(0, 100).toString());
                }
            }
        });

    }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
    });
});
