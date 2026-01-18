const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');
const OSS = require('ali-oss');

const repoRoot = path.resolve(__dirname, '..');
const PORT = 3001; // Use a different port to avoid conflict
const DEV_SERVER_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.join(repoRoot, 'previews');
const PREVIEW_WIDTH = 1024;
const PREVIEW_HEIGHT = 1024;
const CAMERA_ORBIT = '45deg 75deg 105%';
// ---

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

const getPublicAssetBase = () => {
  const cdnBase = normalizeBaseUrl(process.env.CDN_DOMAIN);
  if (cdnBase) return cdnBase;

  const bucket = process.env.OSS_BUCKET;
  const region = process.env.OSS_REGION;
  if (!bucket || !region) return '';

  return `https://${bucket}.${region}.aliyuncs.com`;
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
    secure: true, // often needed
  });
};

// Simple static server
const startServer = () => {
  const server = http.createServer((req, res) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    console.log(`[Server] ${req.method} ${req.url}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      const parsedUrl = url.parse(req.url);
      const pathname = decodeURIComponent(parsedUrl.pathname);
      let filePath;

      // Wrap-specific routing:
      if (pathname === '/render_config.json') {
        filePath = path.join(repoRoot, 'render_config.json');
      } else if (pathname.startsWith('/uploads/')) {
        // If path starts with /uploads/, serve from repoRoot/uploads
        filePath = path.join(repoRoot, pathname); // pathname includes /uploads/
      } else {
        // Otherwise serve from public
        filePath = path.join(repoRoot, 'public', pathname);
      }

      if (!fsSync.existsSync(filePath) || fsSync.statSync(filePath).isDirectory()) {
        // Try index.html if directory? No, usually not needed for this purpose.
        // But if file doesn't exist:
        if (!fsSync.existsSync(filePath)) {
          console.log(`[Server] 404 Not Found: ${pathname} -> Resolved: ${filePath}`);
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
      console.log(`🔌 Local asset server started at ${DEV_SERVER_URL}`);
      resolve(server);
    });
  });
};

async function generatePreview(browser, modelUrl, textureUrl, outputPath, modelSlug) {
  const page = await browser.newPage();
  await page.setViewport({ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT });

  // If modelUrl or textureUrl are relative (start with /), prepend DEV_SERVER_URL
  const fullModelUrl = modelUrl.startsWith('http') ? modelUrl : `${DEV_SERVER_URL}${modelUrl}`;
  const fullTextureUrl = textureUrl.startsWith('http') ? textureUrl : `${DEV_SERVER_URL}${textureUrl}`;

  // Check for model-specific config
  let extraParams = '';
  if (['model-y', 'model-3-highland', 'model-y-2025-premium', 'model-3-legacy', 'model-y-legacy', 'model-y-juniper', 'cybertruck', 'Model 3', 'Model 3 2024+', 'Model Y', 'Model Y 2025+', 'Cybertruck'].includes(modelSlug)) {
    extraParams = '&applyStrategy=all';
  }
  const visualizerUrl = `${DEV_SERVER_URL}/visualizer.html?modelUrl=${encodeURIComponent(fullModelUrl + '?t=' + Date.now())}&textureUrl=${encodeURIComponent(fullTextureUrl)}&modelSlug=${encodeURIComponent(modelSlug)}${extraParams}`;

  // Capture console logs for debugging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    // Load render config if exists
    const configPath = path.join(__dirname, '..', 'render_config.json');
    let renderConfig = null;
    if (fsSync.existsSync(configPath)) {
      try {
        const raw = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
        const full = (raw && (raw.defaults || raw.models))
          ? { defaults: raw.defaults || {}, models: raw.models || {} }
          : { defaults: raw || {}, models: {} };
        renderConfig = { ...full.defaults, ...(full.models?.[modelSlug] || {}) };
        renderConfig.hiddenMaterials = renderConfig.hiddenMaterials || [];
        renderConfig.bodyMaterials = renderConfig.bodyMaterials || [];
        console.log('📦 Loaded merged render config:', renderConfig);
      } catch (e) {
        console.error('Failed to parse render_config.json', e);
      }
    }

    await page.goto(visualizerUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for model-viewer to be ready (custom event or ensuring element exists)
    await page.waitForFunction(() => window.__modelViewerReady === true, { timeout: 60000 });

    // Check for errors
    const error = await page.evaluate(() => window.__modelViewerError);
    if (error) {
      throw new Error(`Visualizer reported error: ${error}`);
    }

    // Apply Custom Render Config if available
    if (renderConfig) {
      await page.evaluate((config) => {
        const mv = document.querySelector('model-viewer');
        if (!mv) return;

        const bodyMaterials = Array.isArray(config.bodyMaterials) ? config.bodyMaterials : [];
        const isBodyMaterial = (name) => {
          const key = name || '';
          if (bodyMaterials.length > 0) return bodyMaterials.includes(key);

          const lowerName = String(name || '').toLowerCase();
          return (
            key === '' ||
            lowerName.includes('paint') ||
            lowerName.includes('exterior') ||
            lowerName.includes('body') ||
            name === 'EXT_BODY' ||
            name === 'Stainless_Steel_Exterior'
          );
        };

        // 1. Camera & Environment
        if (config.cameraOrbit) mv.setAttribute('camera-orbit', config.cameraOrbit);
        if (config.shadowIntensity) mv.setAttribute('shadow-intensity', config.shadowIntensity);
        if (config.exposure) mv.setAttribute('exposure', config.exposure);
        if (config.fieldOfView) mv.setAttribute('field-of-view', config.fieldOfView);

        mv.jumpCameraToGoal();

        // 3. Base Color (White/Custom)
        if (config.baseColor) {
          const rgba = ((hex) => {
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            return [r, g, b, 1.0];
          })(config.baseColor);

          mv.model.materials.forEach(material => {
            const name = material.name;
            if (isBodyMaterial(name)) {
              material.pbrMetallicRoughness.setBaseColorFactor(rgba);
            }
          });
        }
        // 3a. UV Swap Logic (Fix Symmetry)
        if (config.useUniqueUVs) {
          try {
            const symbols = Object.getOwnPropertySymbols(mv);
            const sceneSymbol = symbols.find(s => s.description === 'scene');
            const scene = mv[sceneSymbol];

            if (scene) {
              scene.traverse((node) => {
                if (node.isMesh && node.material) {
                  const mats = Array.isArray(node.material) ? node.material : [node.material];
                  mats.forEach((mat) => {
                    if (!isBodyMaterial(mat.name)) return;

                    const geom = node.geometry;

                    const hasUV1 = !!geom.attributes.uv1;
                    const hasUV2 = !!geom.attributes.uv2;
                    const secondaryKey = hasUV1 ? 'uv1' : (hasUV2 ? 'uv2' : null);

                    if (secondaryKey && !geom.userData.swapped) {
                      const primary = geom.attributes.uv;
                      const secondary = geom.attributes[secondaryKey];

                      geom.attributes.uv = secondary;
                      geom.attributes[secondaryKey] = primary;

                      geom.attributes.uv.needsUpdate = true;
                      geom.attributes[secondaryKey].needsUpdate = true;
                      geom.userData.swapped = true;
                    }
                  });
                }
              });
            }
          } catch (e) { console.warn("UV Swap failed in Puppeteer:", e); }
        }

        // 4. Texture Transform (Rotation/Scale/Mirror)
        try {
          const symbols = Object.getOwnPropertySymbols(mv);
          const sceneSymbol = symbols.find(s => s.description === 'scene');
          const scene = mv[sceneSymbol];

          if (scene) {
            let referenceMap = null;

            scene.traverse((node) => {
              if (!node.isMesh || !node.material || referenceMap) return;
              const mats = Array.isArray(node.material) ? node.material : [node.material];
              for (const mat of mats) {
                if (isBodyMaterial(mat.name) && mat.map) {
                  referenceMap = mat.map;
                  return;
                }
              }
            });

            scene.traverse((node) => {
              if (!node.isMesh || !node.material) return;
              const mats = Array.isArray(node.material) ? node.material : [node.material];

              mats.forEach((mat) => {
                if (!isBodyMaterial(mat.name)) return;

                mat.side = 2;

                if (config.baseColor && mat.color) {
                  mat.color.setHex(parseInt(config.baseColor.replace('#', ''), 16));
                }

                if (!mat.map && referenceMap) {
                  mat.map = referenceMap;
                }

                if (mat.map) {
                  mat.map.center.set(0.5, 0.5);

                  if (config.rotation !== undefined) {
                    mat.map.rotation = (config.rotation * Math.PI) / 180;
                  }

                  if (config.scale !== undefined) {
                    const scaleX = config.mirror ? -config.scale : config.scale;
                    mat.map.repeat.set(scaleX, config.scale);
                  }

                  mat.map.wrapS = 1000;
                  mat.map.wrapT = 1000;
                  mat.map.needsUpdate = true;
                  mat.needsUpdate = true;
                }
              });
            });
          }
        } catch (e) {
          console.warn("Could not apply texture transform in Puppeteer:", e);
        }

        // 5. Hide Materials
        if (config.hiddenMaterials && Array.isArray(config.hiddenMaterials)) {
          console.log("   Hiding materials:", config.hiddenMaterials);
          // Traverse scene or iterate materials to hide
          // Simple method via material array if names match perfectly
          if (mv.model && mv.model.materials) {
            mv.model.materials.forEach(mat => {
              if (config.hiddenMaterials.includes(mat.name)) {
                // Hiding strategy: Set BaseColor Alpha to 0
                // We keep RGB but set A=0
                const color = mat.pbrMetallicRoughness.baseColorFactor; // [r, g, b, a]
                if (color) {
                  mat.pbrMetallicRoughness.setBaseColorFactor([color[0], color[1], color[2], 0.0]);
                  // Ensure Blend Mode allows transparency
                  mat.setAlphaMode('BLEND');
                }
              }
            });
          }
        }
      }, renderConfig);

      // Minimal delay for config to apply
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`📸 Taking screenshot for ${path.basename(outputPath)}...`);

    const modelViewer = await page.$('model-viewer');

    // Minimal delay before screenshot
    await new Promise(resolve => setTimeout(resolve, 200));

    await (modelViewer || await page.$('model-viewer')).screenshot({ path: outputPath });      // Force regeneration for fix
    // if (fsSync.existsSync(outputPath)) {
    //   console.log(`   ⏭️ Skipped (exists): ${path.basename(outputPath)}`);
    //   continue;
    // }
    console.log(`   ✅ Generated: ${path.basename(outputPath)}`);

  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    return false;
  } finally {
    await page.close();
  }
  return true;
}

async function main() {
  const ONE_ONLY = true; // User requested "Generate one first"

  const supabase = getSupabaseAdmin();
  const ossClient = getOssClient();
  if (!supabase || !ossClient) {
    console.error('Initial checks failed. Exiting.');
    return;
  }

  // Start server
  const server = await startServer();

  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  const { data: models, error: modelsError } = await supabase
    .from('wrap_models')
    .select('id, slug, model_3d_url')
    .eq('is_active', true)
    .not('model_3d_url', 'is', null);

  if (modelsError) {
    console.error('DB Error:', modelsError);
    server.close();
    return;
  }

  // Filter by slug if provided arg
  const targetSlug = process.argv[2];
  const filteredModels = targetSlug ? models.filter(m => m.slug === targetSlug) : models;

  if (!filteredModels || filteredModels.length === 0) {
    // ... logs
    server.close();
    return;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-web-security']
  });

  for (const model of filteredModels) {
    console.log(`\n--- Processing model: ${model.slug} ---`);

    // Create model specific preview folder
    const modelPreviewDir = path.join(SCREENSHOT_DIR, model.slug);
    if (!fsSync.existsSync(modelPreviewDir)) {
      await fs.mkdir(modelPreviewDir, { recursive: true });
    } else {
      // Clean existing files to keep it accurate
      const files = await fs.readdir(modelPreviewDir);
      for (const file of files) {
        await fs.unlink(path.join(modelPreviewDir, file));
      }
    }

    // Get wraps logic...   
    const { data: wrapModelMaps } = await supabase.from('wrap_model_map').select('wrap_id').eq('model_id', model.id);
    const wrapIds = wrapModelMaps.map(x => x.wrap_id);

    if (wrapIds.length === 0) continue;

    const { data: wraps, error: wrapsError } = await supabase
      .from('wraps')
      .select('id, slug, wrap_image_url, category')
      .in('id', wrapIds);

    if (wrapsError) {
      console.error(wrapsError);
      continue;
    }


    for (const wrap of wraps) {
      const localFilename = `${wrap.slug}.png`;
      const outputPath = path.join(modelPreviewDir, localFilename);

      // OSS Key: Flat or structured, but WITH timestamp for cache busting
      const timestamp = new Date().getTime();
      const ossFilename = `${model.slug}-${wrap.slug}-v${timestamp}.png`;

      // Try to construct local paths to avoid network/CORS issues
      let modelUrl = model.model_3d_url;
      let textureUrl = wrap.wrap_image_url;

      // 尝试本地模型路径，优先使用 slug.glb 格式
      const localModelPathSlug = `/uploads/catalog/${model.slug}/${model.slug}.glb`;
      const localModelPathDefault = `/uploads/catalog/${model.slug}/model.glb`;

      if (fsSync.existsSync(path.join(repoRoot, localModelPathSlug))) {
        modelUrl = localModelPathSlug;
      } else if (fsSync.existsSync(path.join(repoRoot, localModelPathDefault))) {
        modelUrl = localModelPathDefault;
      }

      // Try local texture
      if (wrap.category) {
        const filename = path.basename(wrap.wrap_image_url || '');
        const decodedFilename = decodeURIComponent(filename);
        const localTexturePathDecoded = `/uploads/catalog/${model.slug}/wraps/${wrap.category}/${decodedFilename}`;
        if (fsSync.existsSync(path.join(repoRoot, localTexturePathDecoded))) {
          textureUrl = localTexturePathDecoded;
        } else {
          // Fallback to model-y-2025-standard or model-3-highland if not found
          const fallbackPath = `/uploads/catalog/model-y-2025-standard/wraps/${wrap.category}/${decodedFilename}`;
          if (fsSync.existsSync(path.join(repoRoot, fallbackPath))) {
            textureUrl = fallbackPath;
          }
        }
      }

      console.log(`   RENDER: Model=${modelUrl} Texture=${textureUrl}`);

      const success = await generatePreview(browser, modelUrl, textureUrl, outputPath, model.slug);

      if (success) {
        // Upload to OSS with timestamp to ensure CDN update
        const ossKey = `previews/wraps/${ossFilename}`;
        try {
          await ossClient.put(ossKey, outputPath);

          const publicBase = getPublicAssetBase();
          if (!publicBase) {
            throw new Error('Missing CDN_DOMAIN (or OSS_BUCKET/OSS_REGION) for preview_image_url');
          }

          const previewUrl = `${publicBase}/${encodePathSegments(ossKey)}`;

          await supabase
            .from('wraps')
            .update({ preview_image_url: previewUrl })
            .eq('id', wrap.id);

          console.log(`      🔗 Uploaded & Linked: ${previewUrl}`);

        } catch (uploadError) {
          console.error(`      ❌ Upload/Update failed: ${uploadError.message}`);
        }
      }
    }
  }

  await browser.close();
  server.close();
  console.log('\n🎉 All done.');
}

main().catch(err => {
  console.error('Script panic:', err);
  process.exit(1);
});
