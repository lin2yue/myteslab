const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Load Env
const loadEnvFileIfPresent = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (!key || process.env[key]) continue;
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
};
loadEnvFileIfPresent(path.resolve(__dirname, '../.env'));
loadEnvFileIfPresent(path.resolve(__dirname, '../.env.local'));

// Base URL for models
const CDN_DOMAIN = process.env.CDN_DOMAIN ? process.env.CDN_DOMAIN.replace(/\/+$/, '') : 'http://cdn.tewan.club';
const BASE_URL = `${CDN_DOMAIN}/tesla_3d_models/`;

// Model Definitions & Mappings
let MODELS = [];
try {
    MODELS = require('./model_sources.json');
} catch (e) {
    console.error("Could not load model_sources.json", e);
    process.exit(1);
}

const OUTPUT_DIR = path.resolve(__dirname, '../uploads/catalog');

// Helper to download file
async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function processModel(model) {
    console.log(`\n--- Processing ${model.name} (${model.slug}) ---`);
    const modelDir = path.join(OUTPUT_DIR, model.slug);
    ensureDir(modelDir);

    let gltfFilename = model.gltf;
    if (!gltfFilename.endsWith('.gltf') && !gltfFilename.endsWith('.glb')) {
        gltfFilename += '.gltf';
    }
    const gltfUrl = `${BASE_URL}${gltfFilename}`;
    const localGltfPath = path.join(modelDir, 'temp.gltf');
    const outputGlbPath = path.join(modelDir, 'model.glb');

    try {
        // 1. Download GLTF
        console.log(`Downloading GLTF: ${gltfUrl}`);
        try {
            await downloadFile(gltfUrl, localGltfPath);
        } catch (e) {
            console.error(`Skipping ${model.name}: GLTF not found or error.`);
            return;
        }

        // 2. Read GLTF to find BIN and Textures
        const gltfContent = JSON.parse(fs.readFileSync(localGltfPath, 'utf8'));
        const buffers = gltfContent.buffers || [];
        const images = gltfContent.images || [];

        // 3. Download all buffers
        for (const buffer of buffers) {
            if (buffer.uri) {
                const binUrl = `${BASE_URL}${buffer.uri}`;
                const localBinPath = path.join(modelDir, buffer.uri);
                console.log(`Downloading BIN: ${binUrl}`);
                await downloadFile(binUrl, localBinPath);
            }
        }

        // 3.5 Download all textures
        for (const image of images) {
            if (image.uri) {
                // Handle relative paths in uri (e.g. "textures/000.png")
                const textureUrl = `${BASE_URL}${image.uri}`;
                const localTexturePath = path.join(modelDir, image.uri);

                // Ensure subdir exists
                ensureDir(path.dirname(localTexturePath));

                console.log(`Downloading Texture: ${textureUrl}`);
                try {
                    await downloadFile(textureUrl, localTexturePath);
                } catch (e) {
                    console.warn(`⚠️ Failed to download texture ${image.uri}: ${e.message}`);
                    // proceed? Missing texture might break packing or just show error.
                    // gltf-transform might fail if file missing.
                }
            }
        }

        // 4. Convert to GLB using gltf-transform
        console.log(`Converting to GLB...`);
        try {
            // Using 'copy' to convert format. 
            execSync(`npx @gltf-transform/cli copy "${localGltfPath}" "${outputGlbPath}"`, { stdio: 'inherit' });
            console.log(`✅ Success: ${outputGlbPath}`);
        } catch (err) {
            console.error(`❌ Conversion failed: ${err.message}`);
        }

        // Cleanup temps (optional, maybe keep for debug)
        // fs.unlinkSync(localGltfPath);

    } catch (err) {
        console.error(`❌ Error processing ${model.name}:`, err);
    }
}

async function main() {
    for (const model of MODELS) {
        await processModel(model);
    }
    console.log('\n🎉 Batch processing complete.');
}

main();
