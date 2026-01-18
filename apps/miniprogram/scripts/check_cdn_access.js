const https = require('https');

const urls = [
    'https://cdn.tewan.club/previews/wraps/Model%203-model-3-official-valentine-v1768421630345.png',
    'https://cdn.tewan.club/previews/wraps/Model%203-model-3-official-rudi-v1768421638333.png',
    'https://cdn.tewan.club/previews/wraps/Model%203-model-3-official-leopard-v1768421644828.png',
    'https://cdn.tewan.club/previews/wraps/Model%203-model-3-official-cosmic-burst-v1768421650635.png',
    'https://cdn.tewan.club/previews/wraps/Model%203-model-3-official-ani-v1768421656460.png'
];

urls.forEach(url => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
        console.log(`${res.statusCode} ${res.headers['content-length']} - ${url}`);
    });
    req.on('error', (e) => console.error(`ERROR: ${url} - ${e.message}`));
    req.end();
});
