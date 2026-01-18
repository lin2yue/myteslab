const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// 下载文件的辅助函数
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);

        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`下载失败: ${url}, 状态码: ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`✓ 已下载: ${path.basename(destPath)}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

// 下载 GLTF 模型及其依赖文件
async function downloadGLTFModel(modelName, gltfUrl, binUrl, outputDir) {
    console.log(`\n开始下载 ${modelName}...`);

    // 创建输出目录
    const modelDir = path.join(outputDir, modelName);
    if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
    }

    // 下载 GLTF 文件
    const gltfPath = path.join(modelDir, `${modelName}.gltf`);
    await downloadFile(gltfUrl, gltfPath);

    // 下载 BIN 文件
    const binPath = path.join(modelDir, path.basename(binUrl));
    await downloadFile(binUrl, binPath);

    // 读取 GLTF 文件找出所需的纹理
    const gltfContent = fs.readFileSync(gltfPath, 'utf8');
    const gltf = JSON.parse(gltfContent);

    // 创建 textures 目录
    const texturesDir = path.join(modelDir, 'textures');
    if (!fs.existsSync(texturesDir)) {
        fs.mkdirSync(texturesDir, { recursive: true });
    }

    // 下载纹理文件
    if (gltf.images) {
        console.log(`找到 ${gltf.images.length} 个纹理文件`);
        for (const image of gltf.images) {
            if (image.uri) {
                const textureUrl = `https://teslawrapgallery.com/tesla_3d_models/${image.uri}`;
                const texturePath = path.join(modelDir, image.uri);

                // 确保纹理子目录存在
                const textureSubDir = path.dirname(texturePath);
                if (!fs.existsSync(textureSubDir)) {
                    fs.mkdirSync(textureSubDir, { recursive: true });
                }

                await downloadFile(textureUrl, texturePath);
            }
        }
    }

    return { gltfPath, modelDir };
}

// 将 GLTF 转换为 GLB
async function convertToGLB(gltfPath, outputPath) {
    console.log(`\n转换为 GLB 格式...`);

    const gltfDir = path.dirname(gltfPath);
    const tempGlbPath = path.join(gltfDir, 'model.glb');

    try {
        // 使用 gltf-pipeline 转换
        const command = `npx gltf-pipeline -i "${gltfPath}" -o "${tempGlbPath}"`;
        console.log(`执行命令: ${command}`);

        const { stdout, stderr } = await execAsync(command);
        if (stdout) console.log(stdout);
        if (stderr) console.log(stderr);

        // 移动到最终位置
        fs.copyFileSync(tempGlbPath, outputPath);
        console.log(`✓ GLB 文件已保存到: ${outputPath}`);

        return outputPath;
    } catch (error) {
        console.error(`转换失败: ${error.message}`);
        throw error;
    }
}

// 主函数
async function main() {
    const baseOutputDir = path.join(__dirname, '..', 'downloads', 'model-y-juniper');

    // 确保输出目录存在
    if (!fs.existsSync(baseOutputDir)) {
        fs.mkdirSync(baseOutputDir, { recursive: true });
    }

    const models = [
        {
            name: 'ModelY_Premium_2025',
            gltfUrl: 'https://teslawrapgallery.com/tesla_3d_models/Bayberry.gltf',
            binUrl: 'https://teslawrapgallery.com/tesla_3d_models/Bayberry0.bin'
        },
        {
            name: 'ModelY_Standard_2025',
            gltfUrl: 'https://teslawrapgallery.com/tesla_3d_models/BayberryE41.gltf',
            binUrl: 'https://teslawrapgallery.com/tesla_3d_models/BayberryE410.bin'
        },
        {
            name: 'ModelY_Pre2025',
            gltfUrl: 'https://teslawrapgallery.com/tesla_3d_models/ModelY_High.gltf',
            binUrl: 'https://teslawrapgallery.com/tesla_3d_models/ModelY_High0.bin'
        }
    ];

    console.log('=== Tesla Model Y Juniper (2025+) 3D 模型下载器 ===\n');

    for (const model of models) {
        try {
            // 下载 GLTF 模型
            const { gltfPath, modelDir } = await downloadGLTFModel(
                model.name,
                model.gltfUrl,
                model.binUrl,
                baseOutputDir
            );

            // 转换为 GLB
            const glbOutputPath = path.join(baseOutputDir, `${model.name}.glb`);
            await convertToGLB(gltfPath, glbOutputPath);

            console.log(`\n✓ ${model.name} 完成！`);
            console.log(`  - GLTF 源文件: ${modelDir}`);
            console.log(`  - GLB 文件: ${glbOutputPath}`);

        } catch (error) {
            console.error(`\n✗ ${model.name} 处理失败:`, error.message);
        }
    }

    console.log('\n=== 全部完成 ===');
    console.log(`输出目录: ${baseOutputDir}`);
}

// 运行
main().catch(console.error);
