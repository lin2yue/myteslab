const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const repoRoot = path.resolve(__dirname, '..');
const PORT = 3001;
const DEV_SERVER_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.join(repoRoot, 'assets', '3d-previews');
const PREVIEW_WIDTH = 1024;
const PREVIEW_HEIGHT = 768;

// --- Helpers ---

const loadEnvFileIfPresent = (filePath) => {
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

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  return createClient(url, key);
};

// --- Static Server ---

const startServer = () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Silence logs for favicon/common requests to keep output clean
    if (!req.url.includes('favicon')) {
      // console.log(`[Server] ${req.method} ${req.url}`);
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      const parsedUrl = url.parse(req.url);
      const pathname = decodeURIComponent(parsedUrl.pathname);
      let filePath;

      if (pathname === '/render_config.json') {
        filePath = path.join(repoRoot, 'render_config.json');
      } else if (pathname.startsWith('/uploads/')) {
        filePath = path.join(repoRoot, pathname);
      } else {
        filePath = path.join(repoRoot, 'public', pathname);
      }

      if (!fsSync.existsSync(filePath) || fsSync.statSync(filePath).isDirectory()) {
        if (!fsSync.existsSync(filePath)) {
          res.statusCode = 404;
          res.end(`Not found: ${pathname}`);
          return;
        }
      }

      const ext = path.extname(filePath);
      const map = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.glb': 'model/gltf-binary',
        '.svg': 'image/svg+xml'
      };

      res.setHeader('Content-Type', map[ext] || 'text/plain');
      const stream = fsSync.createReadStream(filePath);
      stream.pipe(res);
    } catch (err) {
      res.statusCode = 500;
      res.end(`Server error: ${err.message}`);
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`🔌 Generator server started at ${DEV_SERVER_URL}`);
      resolve(server);
    });
  });
};

// --- Generator ---

async function generatePreview(browser, modelUrl, textureUrl, outputPath, modelSlug) {
  const page = await browser.newPage();
  await page.setViewport({ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT });

  const fullModelUrl = modelUrl.startsWith('http') ? modelUrl : `${DEV_SERVER_URL}${modelUrl}`;
  const fullTextureUrl = textureUrl.startsWith('http') ? textureUrl : `${DEV_SERVER_URL}${textureUrl}`;

  // Apply specific logic for certain models if needed (legacy logic preserved)
  let extraParams = '';
  if (['model-y', 'model-3-highland', 'cybertruck', 'Model 3', 'Model 3 2024+', 'Model Y', 'Model Y 2025+', 'Cybertruck'].includes(modelSlug)) {
    extraParams = '&applyStrategy=all';
  }

  const visualizerUrl = `${DEV_SERVER_URL}/visualizer.html?modelUrl=${encodeURIComponent(fullModelUrl + '?t=' + Date.now())}&textureUrl=${encodeURIComponent(fullTextureUrl)}&modelSlug=${encodeURIComponent(modelSlug)}${extraParams}`;

  // Load render config
  let renderConfig = null;
  try {
    const configPath = path.join(repoRoot, 'render_config.json');
    if (fsSync.existsSync(configPath)) {
      const raw = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
      const defaults = raw.defaults || {};
      const models = raw.models || {};
      // Merge defaults with model-specific config
      renderConfig = { ...defaults, ...(models[modelSlug] || {}) };
    }
  } catch (e) {
    console.error('Error loading render_config.json:', e);
  }

  try {
    await page.goto(visualizerUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for model-viewer to be ready
    await page.waitForFunction(() => window.__modelViewerReady === true, { timeout: 60000 });

    const error = await page.evaluate(() => window.__modelViewerError);
    if (error) throw new Error(`Visualizer reported error: ${error}`);

    // Apply Config
    if (renderConfig) {
      console.log(`   ⚙️ Applying config for ${modelSlug} (Zoom: ${renderConfig.cameraOrbit || 'default'})`);
      const ready = await page.evaluate(async (cfg) => {
        if (window.applyConfig) return await window.applyConfig(cfg);
        return false;
      }, renderConfig);
      if (!ready) console.warn('   ⚠️ applyConfig failed');

      // Add a small delay to ensure GPU render catches up
      await new Promise(r => setTimeout(r, 1000));
    }

    const modelViewer = await page.$('model-viewer');
    await (modelViewer || await page.$('model-viewer')).screenshot({ path: outputPath });

    console.log(`   ✅ Generated: ${path.basename(outputPath)}`);
    return true;

  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    // Save screenshot for debugging
    try { await page.screenshot({ path: outputPath + '.error.png' }); } catch (e) { }
    return false;
  } finally {
    await page.close();
  }
}

async function main() {
  // No DB connection needed
  // const supabase = getSupabaseAdmin(); 

  const server = await startServer();
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  // 1. Scan Local Models from Catalog
  const catalogDir = path.join(repoRoot, 'assets', 'models');
  if (!fsSync.existsSync(catalogDir)) {
    console.error(`❌ Catalog directory not found: ${catalogDir}`);
    server.close();
    return;
  }

  const modelFolders = fsSync.readdirSync(catalogDir).filter(f => {
    // Ignore hidden files and non-directories
    if (f.startsWith('.')) return false;
    return fsSync.statSync(path.join(catalogDir, f)).isDirectory();
  });

  console.log(`found local model folders: ${modelFolders.join(', ')}`);

  const models = modelFolders.map(folder => ({
    id: folder, // dummy id
    slug: folder.toLowerCase(), // Heuristic: slug is lowercase folder name
    folder: folder, // Keep original casing for file constraints
    model_3d_url: null // Will define locally later
  }));

  // Parse Args
  const args = process.argv.slice(2);
  const FORCE = args.includes('--force');
  const limitIndex = args.indexOf('--limit');
  const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 0;
  // ... rest of args parsing matches existing code ...
  const wrapIndex = args.indexOf('--wrap');
  const WRAP_FILTER = wrapIndex !== -1 ? args[wrapIndex + 1].toLowerCase() : null;

  // Positional arg for model slug
  const targetSlug = args.find((arg, index) => {
    if (arg.startsWith('--')) return false;
    if (limitIndex !== -1 && index === limitIndex + 1) return false;
    if (wrapIndex !== -1 && index === wrapIndex + 1) return false;
    return true;
  });

  const filteredModels = targetSlug ? models.filter(m => m.slug === targetSlug) : models;

  if (filteredModels.length === 0) {
    console.log(`No matching models found. Available: ${models.map(m => m.slug).join(', ')}`);
    server.close();
    return;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security']
  });

  let generatedCount = 0;

  for (const model of filteredModels) {
    if (LIMIT > 0 && generatedCount >= LIMIT) break;

    console.log(`\n--- Processing model: ${model.slug} ---`);
    const modelPreviewDir = path.join(SCREENSHOT_DIR, model.slug);
    if (!fsSync.existsSync(modelPreviewDir)) {
      await fs.mkdir(modelPreviewDir, { recursive: true });
    }

    // Resolve Model Folder
    // We already have it from the initial scan
    const catalogDir = path.join(repoRoot, 'uploads', 'catalog');
    let modelFolder = model.folder || model.slug;

    // Scan Local Textures

    // Scan Local Textures
    const wrapsDir = path.join(catalogDir, modelFolder, 'wraps');
    let localWraps = [];

    if (fsSync.existsSync(wrapsDir)) {
      const categories = fsSync.readdirSync(wrapsDir);
      for (const cat of categories) {
        // Skip system files like .DS_Store
        if (cat.startsWith('.')) continue;

        const catDir = path.join(wrapsDir, cat);
        if (!fsSync.statSync(catDir).isDirectory()) continue;

        const files = fsSync.readdirSync(catDir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
        for (const f of files) {
          const nameNoExt = path.parse(f).name;
          // Construct a slug-like ID
          const wrapSlug = nameNoExt.toLowerCase().replace(/[\s_]+/g, '-');

          localWraps.push({
            slug: wrapSlug,
            category: cat,
            filename: f,
            // Web-accessible path 
            webPath: `/uploads/catalog/${modelFolder}/wraps/${cat}/${f}`
          });
        }
      }
    }

    console.log(`   Found ${localWraps.length} local textures for ${model.slug} (Folder: ${modelFolder})`);

    if (localWraps.length === 0) {
      console.log('   Warning: No local textures found. Skipping.');
      continue;
    }

    for (const wrap of localWraps) {
      if (LIMIT > 0 && generatedCount >= LIMIT) break;

      // Wrap Filter
      if (WRAP_FILTER) {
        if (!wrap.slug.includes(WRAP_FILTER)) continue;
      }

      // Construct output filename consistent with previous naming convention if possible
      // Or just use wrap slug. 
      // Previous DB logic used wrap.slug which came from DB. 
      // Here we generated a slug from filename. It should be close enough.
      const localFilename = `${model.slug}-${wrap.category.toLowerCase()}-${wrap.slug}.png`;
      const outputPath = path.join(modelPreviewDir, localFilename);

      if (fsSync.existsSync(outputPath) && !FORCE) {
        console.log(`   ⏭️ Skipped (exists): ${localFilename}`);
        continue;
      }

      console.log(`Generating: ${localFilename}`);

      // Path Logic
      // Resolve Model Source
      let modelUrl = model.model_3d_url; // Default remote

      // Try local overrides with correct folder name
      const localPathsToCheck = [
        `/uploads/catalog/${modelFolder}/${model.slug}.glb`,
        `/uploads/catalog/${modelFolder}/model.glb`,
        `/uploads/catalog/${modelFolder}/${modelFolder}.glb`
      ];

      let foundLocal = false;
      for (const p of localPathsToCheck) {
        if (fsSync.existsSync(path.join(repoRoot, p))) {
          modelUrl = p;
          foundLocal = true;
          break;
        }
      }

      console.log(`   ${foundLocal ? '📂 Model:' : '☁️  Model:'} ${path.basename(modelUrl)} | 🎨 Texture: ${wrap.filename}`);

      // Texture is always local now
      const textureUrl = wrap.webPath;

      const success = await generatePreview(browser, modelUrl, textureUrl, outputPath, model.slug);
      if (success) generatedCount++;
    }
  }

  await browser.close();
  server.close();
  console.log(`\n🎉 Done. Generated ${generatedCount} previews.`);
}

main().catch(console.error);
