const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const http = require('http');
const { URL } = require('url');
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch {
  puppeteer = require('../apps/miniprogram/node_modules/puppeteer');
}

const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(__dirname, 'community-3d-transparent');
const sourceDir = path.join(outDir, 'textures');
const port = 3317;
const baseUrl = `http://127.0.0.1:${port}`;
const width = 1024;
const height = 768;

const viewerConfig = require('../apps/web-cn/src/config/viewer-config.json');

const jobs = [
  {
    slug: 'f1-mercedes',
    modelSlug: 'model-3-2024',
    modelUrl: '/assets/models/model3-2024-base/body.glb',
    wheelUrl: '/assets/models/wheels/induction.glb',
    textureUrl: 'https://cdn.tewan.club/wraps/ai-generated/wrap-d607695a-1769240543506.png',
  },
  {
    slug: 'duck',
    modelSlug: 'model-3-2024',
    modelUrl: '/assets/models/model3-2024-base/body.glb',
    wheelUrl: '/assets/models/wheels/induction.glb',
    textureUrl: 'https://cdn.tewan.club/wraps/ai-generated/wrap-3cff6111-1769197385373.png',
  },
  {
    slug: 'shark',
    modelSlug: 'model-y',
    modelUrl: '/assets/models/modely/body.glb',
    wheelUrl: '/assets/models/wheels/induction.glb',
    textureUrl: 'https://cdn.tewan.club/wraps/ai-generated/wrap-5b633b08-1769047031325.png',
  },
  {
    slug: 'banana-cybertruck',
    modelSlug: 'cybertruck',
    modelUrl: '/assets/models/cybertruck/body.glb',
    wheelUrl: '/assets/models/wheels/cybertruck_wheels.glb',
    textureUrl: 'https://cdn.tewan.club/wraps/ai-generated/migrated-14116eb5-1769191171810.png',
  },
];

const renderShadow = process.argv.includes('--shadow');

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.glb': 'model/gltf-binary',
  }[ext] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      const parsed = new URL(req.url, baseUrl);
      let filePath;
      if (parsed.pathname === '/visualizer.html') {
        filePath = path.join(__dirname, 'visualizer.html');
      } else if (parsed.pathname.startsWith('/assets/')) {
        filePath = path.join(repoRoot, parsed.pathname);
      } else if (parsed.pathname.startsWith('/textures/')) {
        filePath = path.join(sourceDir, path.basename(parsed.pathname));
      } else {
        res.statusCode = 404;
        res.end('not found');
        return;
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.statusCode = 404;
        res.end(`not found: ${parsed.pathname}`);
        return;
      }
      res.setHeader('Content-Type', contentType(filePath));
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error && error.stack || error));
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

async function download(url, outPath) {
  if (fs.existsSync(outPath)) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(outPath, buffer);
}

async function renderJob(browser, job) {
  const texturePath = path.join(sourceDir, `${job.slug}.png`);
  await download(job.textureUrl, texturePath);

  const page = await browser.newPage();
  page.on('console', (msg) => {
    const text = msg.text();
    if (/error|failed|Texture loaded|Model loaded|Applying config/i.test(text)) {
      console.log(`[${job.slug}] ${text}`);
    }
  });
  page.on('pageerror', (err) => console.error(`[${job.slug}] page error`, err));
  await page.setViewport({ width, height, deviceScaleFactor: 1 });

  const url = `${baseUrl}/visualizer.html?modelUrl=${encodeURIComponent(baseUrl + job.modelUrl)}&textureUrl=${encodeURIComponent(baseUrl + `/textures/${job.slug}.png`)}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.__modelViewerReady === true, { timeout: 60000 });

  const error = await page.evaluate(() => window.__modelViewerError);
  if (error) throw new Error(`${job.slug}: model-viewer error: ${error}`);

  const config = {
    ...viewerConfig.defaults,
    ...(viewerConfig.models[job.modelSlug] || {}),
    shadowIntensity: renderShadow ? (viewerConfig.models[job.modelSlug]?.shadowIntensity ?? viewerConfig.defaults.shadowIntensity ?? 1.2) : 0,
    shadowSoftness: renderShadow ? (viewerConfig.models[job.modelSlug]?.shadowSoftness ?? viewerConfig.defaults.shadowSoftness ?? 0.9) : 0,
  };

  await page.evaluate(async (cfg, wheelUrl) => {
    function getThreeScene(viewer) {
      for (const sym of Object.getOwnPropertySymbols(viewer)) {
        const val = viewer[sym];
        if (val && (val.isScene || (val.scene && val.scene.isScene))) {
          return val.isScene ? val : val.scene;
        }
      }
      if (viewer.scene && viewer.scene.isScene) return viewer.scene;
      return null;
    }

    function isWheelAnchor(name) {
      const n = String(name || '').toUpperCase();
      return n.includes('WHEEL') && n.includes('SPATIAL') && !n.includes('STEERING');
    }

    async function injectWheels(viewer, url) {
      if (!url) return;
      const scene = getThreeScene(viewer);
      if (!scene || typeof scene.traverse !== 'function') return;

      const anchors = [];
      scene.traverse((node) => {
        if (isWheelAnchor(node.name)) anchors.push(node);
      });
      if (!anchors.length) {
        console.warn('No wheel anchors found');
        return;
      }

      const [{ GLTFLoader }, { DRACOLoader }, SkeletonUtils] = await Promise.all([
        import('https://esm.sh/three@0.163.0/examples/jsm/loaders/GLTFLoader.js'),
        import('https://esm.sh/three@0.163.0/examples/jsm/loaders/DRACOLoader.js'),
        import('https://esm.sh/three@0.163.0/examples/jsm/utils/SkeletonUtils.js'),
      ]);

      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      draco.setDecoderConfig({ type: 'js' });
      loader.setDRACOLoader(draco);
      const gltf = await loader.loadAsync(url);
      const wheelMaster = gltf.scene;

      for (const anchor of anchors) {
        while (anchor.children.length > 0) anchor.remove(anchor.children[0]);
        const wheel = SkeletonUtils.clone(wheelMaster);
        wheel.rotation.y = 0;
        wheel.scale.set(1, 1, 1);
        wheel.traverse((child) => {
          if (child.isMesh) {
            child.frustumCulled = false;
            child.castShadow = false;
            child.receiveShadow = false;
            if (child.material) {
              child.material.needsUpdate = true;
              child.material.visible = true;
              child.material.side = 2;
            }
          }
        });
        anchor.add(wheel);
      }

      if (viewer.updateBoundingBox) viewer.updateBoundingBox();
      if (viewer.updateFraming) viewer.updateFraming();
      if (typeof viewer.requestRender === 'function') viewer.requestRender();
      console.log(`Injected wheels: ${anchors.length}`);
    }

    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    const viewer = document.querySelector('model-viewer');
    viewer.style.backgroundColor = 'transparent';
    viewer.style.setProperty('--poster-color', 'transparent');
    viewer.setAttribute('camera-controls', 'false');
    viewer.removeAttribute('auto-rotate');
    await window.applyConfig(cfg);
    await injectWheels(viewer, wheelUrl);
    viewer.setAttribute('camera-target', 'auto auto auto');
    viewer.setAttribute('field-of-view', cfg.fieldOfView || '30deg');
    if (typeof viewer.jumpCameraToGoal === 'function') viewer.jumpCameraToGoal();
    if (viewer.requestUpdate) viewer.requestUpdate();
    if (viewer.updateComplete) await viewer.updateComplete;
    if (typeof viewer.requestRender === 'function') viewer.requestRender();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => setTimeout(resolve, 900));
  }, config, job.wheelUrl ? baseUrl + job.wheelUrl : null);

  const output = path.join(outDir, `${job.slug}-3d-transparent${renderShadow ? '-shadow' : ''}.png`);
  const element = await page.$('model-viewer');
  if (!element) throw new Error(`${job.slug}: no model-viewer element`);
  await element.screenshot({ path: output, omitBackground: true });
  await page.close();
  return output;
}

async function main() {
  await fsp.mkdir(sourceDir, { recursive: true });
  const server = await startServer();
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-web-security', '--disable-features=VizDisplayCompositor'],
    });
    const outputs = [];
    for (const job of jobs) {
      console.log(`Rendering ${job.slug}...`);
      outputs.push(await renderJob(browser, job));
      console.log(`Generated ${path.relative(repoRoot, outputs[outputs.length - 1])}`);
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
