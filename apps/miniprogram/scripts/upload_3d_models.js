const path = require('path');
const fs = require('fs');
const OSS = require('ali-oss');
const { createClient } = require('@supabase/supabase-js');

const repoRoot = path.resolve(__dirname, '..');

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

loadEnvFileIfPresent(path.join(repoRoot, '.env'));
loadEnvFileIfPresent(path.join(repoRoot, '.env.local'));

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

const ossBase = `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.region}.aliyuncs.com`;
const publicBase = normalizeBaseUrl(process.env.CDN_DOMAIN) || ossBase;

const MODELS_DIR = path.join(repoRoot, 'uploads/catalog');
const TARGET_PREFIX = 'models/wraps';

const required = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

if (!fs.existsSync(MODELS_DIR)) {
  console.error(`Models directory not found: ${MODELS_DIR}`);
  process.exit(1);
}

const ossClient = new OSS(OSS_CONFIG);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const toSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9_-]/g, '');
};

async function uploadModelFile(modelSlug, filePath) {
  const filename = path.basename(filePath);
  const ossKey = `${TARGET_PREFIX}/${modelSlug}/${filename}`;

  await ossClient.put(ossKey, filePath);

  const url = `${publicBase}/${encodePathSegments(ossKey)}`;
  console.log(`✅ Uploaded ${modelSlug}: ${url}`);
  return url;
}

async function main() {
  console.log('开始上传3D模型文件...\n');

  const modelDirs = fs.readdirSync(MODELS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  if (modelDirs.length === 0) {
    console.error('未找到模型目录');
    process.exit(1);
  }

  console.log(`找到 ${modelDirs.length} 个模型目录\n`);

  for (const folderName of modelDirs) {
    const modelPath = path.join(MODELS_DIR, folderName);
    const modelSlug = toSlug(folderName);

    // 优先使用 slug.glb 格式
    let glbPath = path.join(modelPath, `${modelSlug}.glb`);
    if (!fs.existsSync(glbPath)) {
      // 回退到 model.glb
      glbPath = path.join(modelPath, 'model.glb');
    }

    if (!fs.existsSync(glbPath)) {
      console.log(`⚠️  跳过 ${folderName}: 未找到模型文件`);
      continue;
    }

    try {
      const modelUrl = await uploadModelFile(modelSlug, glbPath);

      const { error } = await supabase
        .from('wrap_models')
        .update({ model_3d_url: modelUrl })
        .eq('slug', modelSlug);

      if (error) {
        console.error(`❌ 更新数据库失败 ${modelSlug}: ${error.message}`);
      } else {
        console.log(`🔗 已更新数据库记录: ${modelSlug}\n`);
      }
    } catch (error) {
      console.error(`❌ 处理失败 ${folderName}: ${error.message}\n`);
    }
  }

  console.log('✅ 所有模型上传完成');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
