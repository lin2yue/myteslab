const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, 'assets/models');
const models = fs.readdirSync(ASSETS_DIR).filter(f => fs.statSync(path.join(ASSETS_DIR, f)).isDirectory());

models.forEach(model => {
    const modelDir = path.join(ASSETS_DIR, model);
    const existingModelPath = path.join(modelDir, 'model.glb');
    const targetPath = path.join(modelDir, 'model_v1.glb');

    // Only rename if model.glb exists and model_v1.glb DOES NOT exist
    if (fs.existsSync(existingModelPath) && !fs.existsSync(targetPath)) {
        console.log(`Renaming ${model}/model.glb -> model_v1.glb...`);
        try {
            fs.renameSync(existingModelPath, targetPath);
            console.log(`✅ Success`);
        } catch (err) {
            console.error(`❌ Failed:`, err.message);
        }
    } else if (fs.existsSync(targetPath)) {
        console.log(`ℹ️  Skipping ${model} (model_v1.glb already exists)`);
    } else {
        console.log(`⚠️  Skipping ${model} (model.glb not found)`);
    }
});
