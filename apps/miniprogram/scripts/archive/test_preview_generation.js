const { launch } = require('puppeteer');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const PORT = 3001;
const DEV_SERVER_URL = `http://localhost:${PORT}`;

// Quick test for Model 3 Highland + Doge wrap
const TEST_CONFIG = {
    modelSlug: 'model-3-highland',
    wrapSlug: 'Doge',
    modelPath: '/uploads/catalog/model-3-highland/model.glb',
    texturePath: '/uploads/catalog/model-3-highland/wraps/official/Doge.png'
};

const http = require('http');
const url = require('url');

async function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const parsed = url.parse(req.url);
            let pathname = decodeURIComponent(parsed.pathname);
            if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

            let filePath;
            if (pathname.startsWith('/uploads/')) {
                filePath = path.join(repoRoot, pathname);
            } else {
                filePath = path.join(repoRoot, 'public', pathname === '/' ? 'index.html' : pathname);
            }

            if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
                const ext = path.extname(filePath);
                const map = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };
                res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
                fs.createReadStream(filePath).pipe(res);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });
        server.listen(PORT, () => resolve(server));
    });
}

async function run() {
    const server = await startServer();
    console.log(`Test server running at ${DEV_SERVER_URL}`);

    const browser = await launch({ headless: false, args: ['--no-sandbox'] }); // Headless false to see it if needed
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 800, height: 600 });

    // Enable console log
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    const modelUrl = `${DEV_SERVER_URL}${TEST_CONFIG.modelPath}`;
    const textureUrl = `${DEV_SERVER_URL}${TEST_CONFIG.texturePath}`;
    const vizUrl = `${DEV_SERVER_URL}/visualizer.html?modelUrl=${encodeURIComponent(modelUrl)}&textureUrl=${encodeURIComponent(textureUrl)}&modelSlug=${encodeURIComponent(TEST_CONFIG.modelSlug)}&applyStrategy=all`;

    console.log(`Navigating to: ${vizUrl}`);
    await page.goto(vizUrl);

    // Wait for ready
    await page.waitForFunction(() => window.__modelViewerReady === true, { timeout: 60000 });

    // Screenshot
    await page.screenshot({ path: 'test_preview_fixed.png' });
    console.log('Saved test_preview_fixed.png');

    await browser.close();
    server.close();
    process.exit(0);
}

run();
