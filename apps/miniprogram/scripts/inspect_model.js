const fs = require('fs');
const path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const draco3d = require('draco3dgltf');
const { KHRDracoMeshCompression } = require('@gltf-transform/extensions');

async function inspect(filePath) {
    console.log(`Inspecting: ${filePath}`);

    const io = new NodeIO()
        .registerExtensions([KHRDracoMeshCompression])
        .registerDependencies({
            'draco3d.decoder': await draco3d.createDecoderModule(),
        });

    const doc = await io.read(filePath);
    const root = doc.getRoot();

    console.log('\n--- Materials ---');
    root.listMaterials().forEach((mat, index) => {
        console.log(`[${index}] "${mat.getName()}"`);
    });

    console.log('\n--- Meshes & Primitives ---');
    root.listMeshes().forEach((mesh, mIndex) => {
        console.log(`Mesh [${mIndex}] "${mesh.getName()}"`);
        mesh.listPrimitives().forEach((prim, pIndex) => {
            const mat = prim.getMaterial();
            const matName = mat ? mat.getName() : 'null';
            const semantics = prim.listSemantics();
            const attributes = semantics.join(', ');

            // Check specific UV semantics
            const hasUV0 = semantics.includes('TEXCOORD_0');
            const hasUV1 = semantics.includes('TEXCOORD_1');

            console.log(`  Prim [${pIndex}] Mat: "${matName}" | UV0: ${hasUV0} | UV1: ${hasUV1}`);
        });
    });
}

const args = process.argv.slice(2);
if (args.length > 0) {
    inspect(args[0]).catch(err => {
        console.error(err);
        process.exit(1);
    });
} else {
    console.log("Usage: node inspect_model.js <path-to-glb>");
}
