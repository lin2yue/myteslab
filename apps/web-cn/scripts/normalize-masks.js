const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function normalizeMasks() {
    const masksDir = path.join(__dirname, '../../../assets/masks');
    const threshold = Number(process.env.MASK_THRESHOLD || 200);

    if (!fs.existsSync(masksDir)) {
        console.error('Error: assets/masks directory not found');
        process.exit(1);
    }

    const files = fs.readdirSync(masksDir).filter(f => f.endsWith('_mask.png'));
    if (files.length === 0) {
        console.log('No mask files found.');
        return;
    }

    console.log(`Normalizing ${files.length} masks with threshold >= ${threshold}...`);

    for (const file of files) {
        const filePath = path.join(masksDir, file);
        const tempPath = `${filePath}.tmp`;

        await sharp(filePath)
            .grayscale()
            .threshold(threshold)
            .png()
            .toFile(tempPath);

        fs.renameSync(tempPath, filePath);
        console.log(`✔ ${file}`);
    }

    console.log('All masks normalized.');
}

normalizeMasks().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
