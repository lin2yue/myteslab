const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(repoRoot, 'temp_previews');
const CATALOG_DIR = path.join(repoRoot, 'uploads/catalog');

if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
}

// Map known slugs to ensure we target correctly
// The filenames are like: [model_slug]-[model_slug]-[wrap_slug]-v[timestamp].png
// Be careful because slug might contain hyphens.
// Simplest way: iterate catalog dirs and see if filename starts with that slug.

const modelDirs = fs.readdirSync(CATALOG_DIR).filter(d => fs.statSync(path.join(CATALOG_DIR, d)).isDirectory());

console.log(`Found ${modelDirs.length} model directories in catalog.`);

const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.png'));
console.log(`Found ${files.length} preview files to organize.`);

let movedCount = 0;

files.forEach(file => {
    // Find matching model
    // Strategy: Look for the longest matching model slug at the start of the filename
    // to handle cases like 'model-y' vs 'model-y-2025'
    let bestMatch = '';

    for (const slug of modelDirs) {
        if (file.startsWith(slug)) {
            if (slug.length > bestMatch.length) {
                bestMatch = slug;
            }
        }
    }

    if (bestMatch) {
        const targetDir = path.join(CATALOG_DIR, bestMatch, 'wraps/previews');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const srcPath = path.join(SOURCE_DIR, file);
        const destPath = path.join(targetDir, file);

        fs.renameSync(srcPath, destPath);
        console.log(`Moved ${file} -> ${bestMatch}/wraps/previews/`);
        movedCount++;
    } else {
        console.warn(`⚠️ Could not match model for file: ${file}`);
    }
});

console.log(`\n✅ Organized ${movedCount} files.`);
if (movedCount === files.length) {
    console.log('Cleaning up source directory...');
    fs.rmdirSync(SOURCE_DIR);
}
