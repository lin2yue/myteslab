const fs = require('fs');
const path = require('path');

const models = ['model-y-legacy', 'model-y-juniper', 'model-3-legacy', 'model-3-highland', 'cybertruck'];

for (const slug of models) {
    const p = `uploads/catalog/${slug}/temp.gltf`;
    if (fs.existsSync(p)) {
        try {
            const data = JSON.parse(fs.readFileSync(p, 'utf8'));
            const mats = (data.materials || []).map(m => m.name);
            console.log(`\nModel: ${slug}`);
            console.log('Materials:', mats.join(', '));
        } catch (e) {
            console.log(`Error reading ${slug}: ${e.message}`);
        }
    } else {
        console.log(`\nModel: ${slug} - temp.gltf NOT FOUND`);
    }
}
