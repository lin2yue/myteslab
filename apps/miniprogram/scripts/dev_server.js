const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3002;
const REPO_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(REPO_ROOT, 'render_config.json');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.glb': 'model/gltf-binary',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    constparsedUrl = url.parse(req.url, true);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    console.log(`[${req.method}] ${pathname}`);

    // --- API: Save Config ---
    if (req.method === 'POST' && pathname === '/save-config') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const newConfig = JSON.parse(body);
                // Simple validation/sanitization could go here
                fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
                console.log('   ✅ Config saved to render_config.json');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                console.error('   ❌ Failed to save config:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // --- API: Get Catalog (Optional dynamic listing) ---
    // tweak.html currently has fallback, but we could add a real scanner here if needed.
    // For now, let's let it use its recursive fetch or fallback logic.

    // --- Static File Serving ---
    let filePath;

    // 1. Root files (tweak.html, render_config.json)
    if (pathname === '/' || pathname === '/tweak.html') {
        filePath = path.join(REPO_ROOT, 'tweak.html');
    } else if (pathname === '/render_config.json') {
        filePath = CONFIG_PATH;
    }
    // 2. Uploads folder
    else if (pathname.startsWith('/uploads/')) {
        filePath = path.join(REPO_ROOT, pathname);
    }
    // 3. Public folder (scripts, stored assets) - trying public first
    else {
        // Try public first
        let tryPath = path.join(REPO_ROOT, 'public', pathname);
        if (fs.existsSync(tryPath) && fs.statSync(tryPath).isFile()) {
            filePath = tryPath;
        } else {
            // Try root (path might be relative to root for some scripts/assets)
            filePath = path.join(REPO_ROOT, pathname);
        }
    }

    // Check existence
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        console.log(`   ⚠️ Not found: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
    }

    // Serve
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
    console.log(`\n🚀 Tweak Dev Server running at http://localhost:${PORT}/tweak.html`);
    console.log(`   Serving files from: ${REPO_ROOT}`);
    console.log(`   Config file: ${CONFIG_PATH}\n`);
});
