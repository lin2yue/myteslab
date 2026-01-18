const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(repoRoot, 'uploads/catalog');

if (!fs.existsSync(CATALOG_DIR)) {
    console.error(`Catalog directory not found: ${CATALOG_DIR}`);
    process.exit(1);
}

const modelDirs = fs.readdirSync(CATALOG_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

console.log('Model Audit Report\n');
console.log('| Model Slug | model.glb | Official Wraps | Previews |');
console.log('|---|---|---|---|');

modelDirs.forEach(slug => {
    const modelPath = path.join(CATALOG_DIR, slug);
    const glbPath = path.join(modelPath, 'model.glb');
    const wrapsDir = path.join(modelPath, 'wraps/official');
    const previewsDir = path.join(modelPath, 'wraps/previews');

    const hasGlb = fs.existsSync(glbPath) ? '✅' : '❌';

    let wrapCount = 0;
    if (fs.existsSync(wrapsDir)) {
        wrapCount = fs.readdirSync(wrapsDir).filter(f => !f.startsWith('.') && (f.endsWith('.png') || f.endsWith('.jpg'))).length;
    }

    let previewCount = 0;
    if (fs.existsSync(previewsDir)) {
        previewCount = fs.readdirSync(previewsDir).filter(f => !f.startsWith('.') && f.endsWith('.png')).length;
    }

    console.log(`| ${slug} | ${hasGlb} | ${wrapCount} | ${previewCount} |`);
});
