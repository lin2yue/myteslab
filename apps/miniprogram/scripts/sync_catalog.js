const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OSS = require('ali-oss');
const glob = require('glob');

// --- Main Config ---
const repoRoot = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(repoRoot, 'uploads', 'catalog');
// ---

const loadEnvFileIfPresent = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
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

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  return createClient(url, key);
};

const getOssClient = () => {
  const { OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET } = process.env;
  if (!OSS_REGION || !OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET || !OSS_BUCKET) {
    console.error('Missing OSS env vars for upload.');
    return null;
  }
  return new OSS({
    region: OSS_REGION,
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
    bucket: OSS_BUCKET,
  });
};

const toTitle = (text) => {
  return text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

const toSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9_-]/g, '');
};

// 查找模型文件，优先使用 slug.glb 格式，回退到 model.glb
const findModelFile = (modelDir) => {
  const folderName = path.basename(modelDir);
  const slug = toSlug(folderName);

  // 优先使用 slug 格式的文件名
  const slugPath = path.join(modelDir, `${slug}.glb`);
  if (fs.existsSync(slugPath)) {
    return { path: slugPath, filename: `${slug}.glb` };
  }

  // 回退到 model.glb
  const defaultPath = path.join(modelDir, 'model.glb');
  if (fs.existsSync(defaultPath)) {
    return { path: defaultPath, filename: 'model.glb' };
  }

  return null;
};

async function syncModels(supabase, ossClient) {
  console.log('\n--- Syncing Models ---');

  // 获取所有模型文件夹
  const modelDirs = fs.readdirSync(CATALOG_DIR)
    .map(name => path.join(CATALOG_DIR, name))
    .filter(p => fs.statSync(p).isDirectory());

  if (modelDirs.length === 0) {
    console.log('No model directories found. Skipping.');
    return;
  }

  const modelsToUpsert = [];
  for (const modelDir of modelDirs) {
    const folderName = path.basename(modelDir);
    const modelSlug = toSlug(folderName);
    const modelFile = findModelFile(modelDir);

    if (!modelFile) {
      console.log(`⚠️  Skipping ${folderName}: No model file found`);
      continue;
    }

    const ossKey = `models/${modelSlug}/${modelFile.filename}`;

    console.log(`Uploading ${folderName} (${modelFile.filename})...`);
    await ossClient.put(ossKey, modelFile.path);
    const model_3d_url = `${process.env.CDN_DOMAIN}/${ossKey}`;

    modelsToUpsert.push({
      slug: modelSlug,
      name: toTitle(folderName),
      model_3d_url,
      model_url: model_3d_url, // Satisfy legacy constraint
      is_active: true,
    });
  }

  const { error } = await supabase.from('wrap_models').upsert(modelsToUpsert, { onConflict: 'slug' });
  if (error) throw error;
  console.log(`Synced ${modelsToUpsert.length} models.`);
}

async function syncWraps(supabase, ossClient) {
  console.log('\n--- Syncing Wraps ---');
  const wrapFiles = glob.sync(path.join(CATALOG_DIR, '*/wraps/**/*.png'));
  if (wrapFiles.length === 0) {
    console.log('No wrap .png files found. Skipping.');
    return;
  }

  const { data: models } = await supabase.from('wrap_models').select('id,slug');
  const modelMap = new Map(models.map(m => [m.slug, m.id]));

  const wrapsToUpsert = [];

  for (const wrapPath of wrapFiles) {
    const pathParts = wrapPath.split(path.sep);
    const modelSlug = pathParts[pathParts.length - 4];
    const category = pathParts[pathParts.length - 2];
    const filename = path.basename(wrapPath, '.png');

    const ossKey = `wraps/${modelSlug}/${category}/${filename}.png`;
    console.log(`Uploading ${modelSlug} -> ${category} -> ${filename}.png...`);
    await ossClient.put(ossKey, wrapPath);
    const imageUrl = `${process.env.CDN_DOMAIN}/${ossKey}`;

    const wrapSlug = `${modelSlug}-${category}-${filename}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    wrapsToUpsert.push({
      slug: wrapSlug,
      name: toTitle(filename),
      category: category,
      image_url: imageUrl,
      wrap_image_url: imageUrl, // for compatibility with existing schema
      is_active: true,
      _modelSlug: modelSlug, // internal use for mapping
    });
  }

  const { data: upsertedWraps, error } = await supabase.from('wraps').upsert(wrapsToUpsert.map(w => {
    const { _modelSlug, ...rest } = w;
    return rest;
  }), { onConflict: 'slug' }).select('id,slug');
  if (error) throw error;
  console.log(`Synced ${upsertedWraps.length} wraps.`);

  const wrapMap = new Map(upsertedWraps.map(w => [w.slug, w.id]));
  const mappingsToUpsert = new Set();

  for (const wrap of wrapsToUpsert) {
    const modelSlug = wrap._modelSlug;
    const modelId = modelMap.get(modelSlug);
    const wrapId = wrapMap.get(wrap.slug);

    if (modelId && wrapId) {
      mappingsToUpsert.add(JSON.stringify({ wrap_id: wrapId, model_id: modelId }));
    }
  }

  const mappings = Array.from(mappingsToUpsert).map(s => JSON.parse(s));
  if (mappings.length > 0) {
    const { error: mapError } = await supabase.from('wrap_model_map').upsert(mappings, { onConflict: 'wrap_id,model_id' });
    if (mapError) throw mapError;
    console.log(`Synced ${mappings.length} wrap-model mappings.`);
  }
}

async function main() {
  loadEnvFileIfPresent(path.join(repoRoot, '.env'));
  loadEnvFileIfPresent(path.join(repoRoot, '.env.local'));

  const supabase = getSupabaseAdmin();
  const ossClient = getOssClient();
  if (!supabase || !ossClient) return;

  await syncModels(supabase, ossClient);
  await syncWraps(supabase, ossClient);

  console.log('\n🎉 Catalog sync complete.');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
