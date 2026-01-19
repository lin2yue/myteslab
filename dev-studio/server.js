const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const ASSETS_ROOT = path.resolve(__dirname, '../assets/models');
const STUDIO_ROOT = __dirname;
// Keep /uploads/catalog mount for compatibility with frontend/scripts that expect this URL structure
const UPLOADS_MOUNT = '/uploads/catalog';

// Helper to get Content-Type
const getContentType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.html': return 'text/html';
        case '.js': return 'text/javascript';
        case '.css': return 'text/css';
        case '.json': return 'application/json';
        case '.png': return 'image/png';
        case '.jpg': return 'image/jpeg';
        case '.glb': return 'model/gltf-binary';
        default: return 'application/octet-stream';
    }
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);

    console.log(`${req.method} ${pathname}`);

    // API: Catalog with Versions
    if (pathname === '/api/catalog') {
        try {
            const models = [];
            const folders = fs.readdirSync(ASSETS_ROOT).filter(f => fs.statSync(path.join(ASSETS_ROOT, f)).isDirectory());

            folders.forEach(folder => {
                const folderPath = path.join(ASSETS_ROOT, folder);
                const files = fs.readdirSync(folderPath);

                // Find versioned models
                const versions = files
                    .filter(f => f.match(/^model_v(\d+)\.glb$/))
                    .map(f => {
                        const ver = parseInt(f.match(/^model_v(\d+)\.glb$/)[1], 10);
                        return {
                            version: ver,
                            filename: f,
                            path: `${UPLOADS_MOUNT}/${folder}/${f}`
                        };
                    })
                    .sort((a, b) => b.version - a.version);

                // Fallback for non-versioned legacy/dev files
                const legacyFiles = files.filter(f => f === 'model.glb').map(f => ({
                    version: 0,
                    filename: f,
                    path: `${UPLOADS_MOUNT}/${folder}/${f}`
                }));

                const allVersions = [...versions, ...legacyFiles];

                // Skip if no models found
                if (allVersions.length === 0) return;

                // Find Textures
                const textures = [];
                const wrapsPath = path.join(folderPath, 'wraps', 'Official');
                if (fs.existsSync(wrapsPath)) {
                    const textureFiles = fs.readdirSync(wrapsPath).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
                    textureFiles.forEach(tf => {
                        const name = tf.replace(/\.(png|jpg|jpeg)$/, '').replace(/_/g, ' ');
                        textures.push({
                            name: name,
                            path: `${UPLOADS_MOUNT}/${folder}/wraps/Official/${tf}`
                        });
                    });
                }

                models.push({
                    name: folder,
                    slug: folder, // Use folder name as slug (which matches what we use in tweak.html largely)
                    folder: folder,
                    versions: allVersions,
                    textures: textures, // Add textures to model object
                    // Default path is latest version
                    path: allVersions[0].path
                });
            });

            // Transform to the structure expected by catalogData.textures if needed, 
            // but tweak.html logic also looks at catalogData.textures[slug].
            const texturesMap = {};
            models.forEach(m => {
                texturesMap[m.slug] = m.textures;
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ models, textures: texturesMap }));
            return;

        } catch (err) {
            console.error(err);
            res.writeHead(500);
            res.end('Internal Server Error');
            return;
        }
    }

    // Static File Serving
    let filePath;

    // 1. Check if it's a mapped upload path
    if (pathname.startsWith(UPLOADS_MOUNT)) {
        const relativePath = pathname.slice(UPLOADS_MOUNT.length);
        filePath = path.join(ASSETS_ROOT, relativePath);
    } else {
        // 2. Default static file from dev-studio
        if (pathname === '/') pathname = '/tweak.html';
        filePath = path.join(STUDIO_ROOT, pathname);
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': getContentType(filePath) });
        res.end(content);
    } else {
        console.log(`404: ${filePath}`);
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Dev Studio Server running at http://localhost:${PORT}`);
});
