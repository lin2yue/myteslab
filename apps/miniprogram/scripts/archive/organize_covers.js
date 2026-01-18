const fs = require('fs');
const path = require('path');

const uploadsDir = path.resolve(__dirname, '../uploads');

function organizeCovers() {
    console.log('📦 Starting cover organization...');

    // Get all files in uploads directory
    const items = fs.readdirSync(uploadsDir);

    items.forEach(item => {
        // Find .jpg files
        if (item.toLowerCase().endsWith('.jpg')) {
            const imageName = item;
            const albumName = path.parse(item).name;
            const albumPath = path.join(uploadsDir, albumName);
            const imagePath = path.join(uploadsDir, item);

            // Check if corresponding directory exists
            if (fs.existsSync(albumPath) && fs.lstatSync(albumPath).isDirectory()) {
                const targetPath = path.join(albumPath, 'cover.jpg');

                try {
                    // Move and Rename
                    fs.renameSync(imagePath, targetPath);
                    console.log(`✅ Moved: ${imageName} -> ${albumName}/cover.jpg`);
                } catch (e) {
                    console.error(`❌ Failed to move ${imageName}:`, e.message);
                }
            } else {
                console.warn(`⚠️  No folder found for: ${imageName} (Skipped)`);
            }
        }
    });

    console.log('🎉 Organization complete!');
}

organizeCovers();
