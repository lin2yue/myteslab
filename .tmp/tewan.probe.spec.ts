import { test } from '@playwright/test';

const routes = ['/', '/ai-generate/generate', '/pricing', '/login', '/lock-sounds'];

test('probe tewan routes', async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[console.error] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    console.log(`[pageerror] ${err.stack || err.message}`);
  });

  page.on('requestfailed', (req) => {
    console.log(`[requestfailed] ${req.url()} -> ${req.failure()?.errorText ?? 'unknown'}`);
  });

  for (const route of routes) {
    const url = `https://tewan.club${route}`;
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    console.log(`[route] ${route} status=${resp?.status() ?? 'null'} title=${await page.title()}`);
    await page.waitForTimeout(2000);
  }
});
