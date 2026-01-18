const fs = require('fs');
const path = require('path');

const catalogRoot = path.join(__dirname, '../uploads/catalog');

const models = [
    { name: 'Cybertruck', slug: 'cybertruck', folder: 'Cybertruck' },
    { name: 'Model 3', slug: 'model-3', folder: 'model-3' },
    { name: 'Model 3 2024+', slug: 'model-3-2024-plus', folder: 'model-3-2024-plus' },
    { name: 'Model Y', slug: 'model-y', folder: 'model-y-pre-2025' },
    { name: 'Model Y 2025+', slug: 'model-y-2025-plus', folder: 'model-y-2025-plus' }
];

const catalog = {
    models: [],
    textures: {}
};

models.forEach(model => {
    // Add model entry
    catalog.models.push({
        name: model.name,
        slug: model.slug,
        path: `/uploads/catalog/${model.folder}/${model.folder.toLowerCase()}.glb`.replace('Cybertruck/cybertruck.glb', 'Cybertruck/cybertruck.glb').replace('model-3/model-3.glb', 'model-3/model.glb'), // Fix paths later if needed, but standard logic is better.
        // Actually, let's use the standard search logic we verified:
        // Cybertruck -> Cybertruck/cybertruck.glb
        // model-3 -> model-3/model.glb
        folder: model.folder
    });

    // Fix specific model paths based on known structure
    const modelEntry = catalog.models[catalog.models.length - 1];
    if (model.slug === 'cybertruck') {
        modelEntry.path = '/uploads/catalog/Cybertruck/cybertruck.glb';
    } else {
        modelEntry.path = `/uploads/catalog/${model.folder}/model.glb`;
    }

    // Add textures
    const wrapDir = path.join(catalogRoot, model.folder, 'wraps', 'Official');
    catalog.textures[model.slug] = [];

    if (fs.existsSync(wrapDir)) {
        const files = fs.readdirSync(wrapDir);
        files.filter(f => f.endsWith('.png') || f.endsWith('.jpg')).forEach(f => {
            const name = f.replace(/_/g, ' ').replace('.png', '').replace('.jpg', '');
            catalog.textures[model.slug].push({
                name: name,
                path: `/uploads/catalog/${model.folder}/wraps/Official/${f}`
            });
        });
    }
});

console.log(JSON.stringify(catalog, null, 4));
