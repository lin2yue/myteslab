const fs = require('fs');
const { NodeIO, Document } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const draco3d = require('draco3dgltf');

async function inspect() {
    const io = new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
            'draco3d.decoder': await draco3d.createDecoderModule(),
        });

    const doc = await io.read('uploads/catalog/model-3-highland/model.glb');
    const root = doc.getRoot();

    console.log('--- Inspecting UVs for Paint Materials ---');

    let paintMeshes = [];

    root.listMeshes().forEach(mesh => {
        mesh.listPrimitives().forEach(prim => {
            const mat = prim.getMaterial();
            if (mat && (mat.getName() === 'Paint' || mat.getName() === 'PaintRough' || mat.getName() === 'CarPaint' || mat.getName() === 'EXT_BODY')) {
                paintMeshes.push({
                    meshName: mesh.getName(),
                    materialName: mat.getName(),
                    uv0: !!prim.getAttribute('TEXCOORD_0'),
                    uv1: !!prim.getAttribute('TEXCOORD_1'),
                    uv2: !!prim.getAttribute('TEXCOORD_2'),
                    attributes: prim.listAttributes().map(a => a.getName()) // Helper not exactly in API, but getting keys
                });
            }
        });
    });

    // Dedupe
    const unique = [...new Set(paintMeshes.map(JSON.stringify))].map(JSON.parse);
    console.table(unique);
}

inspect().catch(console.error);
