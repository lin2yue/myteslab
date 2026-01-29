
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SOURCE_DIR = 'apps/miniprogram/uploads/catalog_decrypted';
const DEST_BASE_DIR = 'apps/web/public/models';
const WHEELS_DIR = path.join(DEST_BASE_DIR, 'wheels');

if (!fs.existsSync(WHEELS_DIR)) {
    fs.mkdirSync(WHEELS_DIR, { recursive: true });
}

const wheelHashMap = new Map(); // hash -> filename
const modelConfigs = [];

function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

// 1. Process Shared Wheels first to give them nice names
const dirs = fs.readdirSync(SOURCE_DIR, { withFileTypes: true });
const sharedWheelDirs = dirs.filter(d => d.isDirectory() && d.name.startsWith('shared_wheels_'));

for (const dir of sharedWheelDirs) {
    const wheelName = dir.name.replace('shared_wheels_', '');
    const srcFile = path.join(SOURCE_DIR, dir.name, 'body.glb'); // Assuming body.glb is the wheel file in these folders based on previous ls

    if (fs.existsSync(srcFile)) {
        const hash = getFileHash(srcFile);
        const destFilename = `${wheelName}.glb`;
        const destPath = path.join(WHEELS_DIR, destFilename);

        fs.copyFileSync(srcFile, destPath);
        wheelHashMap.set(hash, destFilename);
        console.log(`Processed shared wheel: ${wheelName} -> ${destFilename}`);
    }
}

// 2. Process Car Models
const modelDirs = dirs.filter(d => d.isDirectory() && !d.name.startsWith('shared_wheels_'));

for (const dir of modelDirs) {
    const modelSlug = dir.name;
    const modelSrcDir = path.join(SOURCE_DIR, modelSlug);
    const bodySrc = path.join(modelSrcDir, 'body.glb');
    const wheelsSrc = path.join(modelSrcDir, 'wheels.glb');

    const config = {
        slug: modelSlug,
        name: modelSlug, // Temporary, will need manual refinement or mapping
        model_3d_url: '',
        wheel_url: ''
    };

    // Handle Body
    if (fs.existsSync(bodySrc)) {
        const destModelDir = path.join(DEST_BASE_DIR, modelSlug);
        if (!fs.existsSync(destModelDir)) {
            fs.mkdirSync(destModelDir, { recursive: true });
        }
        const destBodyPath = path.join(destModelDir, 'body.glb');
        fs.copyFileSync(bodySrc, destBodyPath);
        config.model_3d_url = `/models/${modelSlug}/body.glb`;
        console.log(`Processed body: ${modelSlug}`);
    } else {
        console.warn(`Missing body for ${modelSlug}`);
    }

    // Handle Wheels
    if (fs.existsSync(wheelsSrc)) {
        const hash = getFileHash(wheelsSrc);
        let wheelFilename = wheelHashMap.get(hash);

        if (!wheelFilename) {
            // New unique wheel found
            wheelFilename = `${modelSlug}_wheels.glb`;
            const destWheelPath = path.join(WHEELS_DIR, wheelFilename);
            fs.copyFileSync(wheelsSrc, destWheelPath);
            wheelHashMap.set(hash, wheelFilename);
            console.log(`Processed unique wheel: ${modelSlug} -> ${wheelFilename}`);
        } else {
            console.log(`Reused wheel for ${modelSlug} -> ${wheelFilename}`);
        }
        config.wheel_url = `/models/wheels/${wheelFilename}`;
    } else {
        console.warn(`Missing wheels for ${modelSlug}`);
    }

    modelConfigs.push(config);
}

// Output the configuration
console.log('\nGenerated Configuration:');
console.log(JSON.stringify(modelConfigs, null, 2));
