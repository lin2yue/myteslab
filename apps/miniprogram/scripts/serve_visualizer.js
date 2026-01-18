const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3003;
const REPO_ROOT = path.resolve(__dirname, '..');

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    const parsedUrl = url.parse(req.url);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    console.log(`[Request] ${pathname}`);

    let filePath;
    if (pathname === '/render_config.json') {
        filePath = path.join(REPO_ROOT, 'render_config.json');
    } else if (pathname.startsWith('/uploads/')) {
        filePath = path.join(REPO_ROOT, pathname);
    } else {
        // Default to public folder
        if (pathname === '/') pathname = '/visualizer.html';
        filePath = path.join(REPO_ROOT, 'public', pathname);
    }

    const map = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.glb': 'model/gltf-binary',
        '.css': 'text/css'
    };

    if (req.method === 'POST' && pathname === '/save-config') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                // Format JSON nicely
                const json = JSON.parse(body);
                fs.writeFileSync(path.join(REPO_ROOT, 'render_config.json'), JSON.stringify(json, null, 2));
                console.log('Saved config:', json);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error('Save error:', e);
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        const ext = path.extname(filePath);
        res.setHeader('Content-Type', map[ext] || 'text/plain');
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.statusCode = 404;
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Server starting on http://localhost:${PORT}`);
    console.log(`Visualizer: http://localhost:${PORT}/visualizer.html`);
});
