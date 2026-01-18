const path = require('path');
const fs = require('fs');
const OSS = require('ali-oss');
const { createClient } = require('@supabase/supabase-js');

const repoRoot = path.resolve(__dirname, '../../..');

// 加载环境变量
const loadEnvFileIfPresent = (filePath) => {
    const fsSync = require('fs');
    if (!filePath || !fsSync.existsSync(filePath)) return;
    const text = fsSync.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex <= 0) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (!key || process.env[key]) continue;
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
};

loadEnvFileIfPresent(path.join(repoRoot, '.env.local'));
loadEnvFileIfPresent(path.join(repoRoot, 'apps/web/.env.local'));
loadEnvFileIfPresent(path.join(repoRoot, 'apps/miniprogram/.env.local'));

// OSS配置
const OSS_CONFIG = {
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET || 'lock-sounds'
};

const safeDecode = (value) => {
    try {
        return decodeURIComponent(value);
    } catch (err) {
        return value;
    }
};

const encodePathSegments = (input) => String(input || '')
    .split('/')
    .map((segment) => encodeURIComponent(safeDecode(segment)))
    .join('/');

const normalizeBaseUrl = (input) => String(input || '').replace(/\/+$/, '');

const publicBase = normalizeBaseUrl(process.env.CDN_DOMAIN) || `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.region}.aliyuncs.com`;

// 源目录和目标前缀
const MODELS_DIR = path.join(repoRoot, 'assets/models');
const TARGET_PREFIX = 'models/wraps';

// 检查必需的环境变量
const required = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
    console.error(`❌ 缺少环境变量: ${missing.join(', ')}`);
    console.error('请检查 apps/miniprogram/.env.local 文件');
    process.exit(1);
}

if (!fs.existsSync(MODELS_DIR)) {
    console.error(`❌ 模型目录不存在: ${MODELS_DIR}`);
    process.exit(1);
}

// 初始化客户端
const ossClient = new OSS(OSS_CONFIG);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 车型文件夹名称到数据库slug的映射
const FOLDER_TO_SLUG = {
    'Cybertruck': 'cybertruck',
    'model-3': 'model-3',
    'model-3-2024-plus': 'model-3-2024-plus',
    'model-y-2025-plus': 'model-y-2025-plus',
    'model-y-pre-2025': 'model-y-pre-2025'
};

async function uploadModelFile(slug, filePath) {
    const filename = 'model.glb'; // 统一使用model.glb命名
    const ossKey = `${TARGET_PREFIX}/${slug}/${filename}`;

    console.log(`📤 上传中: ${slug}...`);

    const fileStats = fs.statSync(filePath);
    const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
    console.log(`   文件大小: ${fileSizeMB} MB`);

    await ossClient.put(ossKey, filePath);

    const url = `${publicBase}/${encodePathSegments(ossKey)}`;
    console.log(`✅ 上传成功: ${url}\n`);

    return url;
}

async function main() {
    console.log('🚀 开始上传3D模型文件到CDN\n');
    console.log(`源目录: ${MODELS_DIR}`);
    console.log(`目标: ${publicBase}/${TARGET_PREFIX}\n`);

    const modelFolders = Object.keys(FOLDER_TO_SLUG);
    let successCount = 0;
    let failCount = 0;

    for (const folderName of modelFolders) {
        const slug = FOLDER_TO_SLUG[folderName];
        let modelPath = path.join(MODELS_DIR, folderName, 'model.glb');
        let useFallback = false;

        // 检查 model.glb 是否有效 (至少 100KB)
        if (!fs.existsSync(modelPath) || fs.statSync(modelPath).size < 100 * 1024) {
            useFallback = true;
        }

        if (useFallback) {
            const fallbackPath = path.join(MODELS_DIR, folderName, `${slug}.glb`);
            if (fs.existsSync(fallbackPath)) {
                modelPath = fallbackPath;
            } else {
                // 如果没有以 slug 命名的文件，再找找看有没有其他较大的 glb
                const files = fs.readdirSync(path.join(MODELS_DIR, folderName));
                const glbFiles = files.filter(f => f.endsWith('.glb') && f !== 'model.glb' && !f.includes('backup'));
                if (glbFiles.length > 0) {
                    modelPath = path.join(MODELS_DIR, folderName, glbFiles[0]);
                }
            }
        }

        if (!fs.existsSync(modelPath) || fs.statSync(modelPath).size < 100 * 1024) {
            console.log(`⚠️  跳过 ${folderName}: 未找到有效的模型文件`);
            failCount++;
            continue;
        }

        try {
            // 上传文件
            const modelUrl = await uploadModelFile(slug, modelPath);

            // 更新数据库
            const { error } = await supabase
                .from('wrap_models')
                .update({ model_3d_url: modelUrl })
                .eq('slug', slug);

            if (error) {
                console.error(`❌ 更新数据库失败 ${slug}: ${error.message}\n`);
                failCount++;
            } else {
                console.log(`🔗 已更新数据库记录: ${slug}\n`);
                successCount++;
            }
        } catch (error) {
            console.error(`❌ 处理失败 ${folderName}: ${error.message}\n`);
            failCount++;
        }
    }

    console.log('━'.repeat(60));
    console.log(`\n✅ 上传完成!`);
    console.log(`   成功: ${successCount} 个`);
    console.log(`   失败: ${failCount} 个`);
    console.log(`\n💡 提示: 如果CDN有缓存,可能需要等待几分钟才能访问新文件\n`);
}

main().catch((err) => {
    console.error('❌ 脚本执行失败:', err);
    process.exit(1);
});
