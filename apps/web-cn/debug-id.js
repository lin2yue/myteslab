const { Polar } = require('@polar-sh/sdk');
// No dotenv needed if I run it with env vars directly if needed, but let's try to read it
const fs = require('fs');
const env = fs.readFileSync('/Users/linpengfei/work/tesla-studio-monorepo/apps/web/.env.local', 'utf8');
const token = env.match(/POLAR_ACCESS_TOKEN=(.*)/)[1].trim();
const orgId = env.match(/POLAR_ORGANIZATION_ID=(.*)/)[1].trim();

const polar = new Polar({
  accessToken: token,
  server: 'production',
});

async function listProducts() {
  try {
    const result = await polar.products.list({
      organizationId: orgId,
    });
    console.log('--- Polar Products ---');
    result.result.items.forEach(p => {
      console.log(`Name: ${p.name}, ID: ${p.id}`);
    });
  } catch (e) {
    console.error('Error:', e.message);
  }
}

listProducts();
