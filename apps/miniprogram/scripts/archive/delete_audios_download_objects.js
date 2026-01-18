const path = require('path');
const fs = require('fs');
const OSS = require('ali-oss');

const loadEnvFileIfPresent = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(process.env, key) && process.env[key]) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

loadEnvFileIfPresent(path.resolve(__dirname, '..', '.env'));
loadEnvFileIfPresent(path.resolve(__dirname, '..', '.env.local'));

const required = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const OSS_CONFIG = {
  region: process.env.OSS_REGION || 'oss-cn-beijing',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET || 'lock-sounds'
};

const client = new OSS(OSS_CONFIG);

async function main() {
  const prefix = 'audios-download/';

  let marker = undefined;
  let totalFound = 0;
  let totalDeleted = 0;

  while (true) {
    const result = await client.list({ prefix, marker, 'max-keys': 1000 });
    const objects = (result && result.objects) ? result.objects : [];
    const keys = objects.map((o) => o.name).filter(Boolean);

    if (keys.length > 0) {
      totalFound += keys.length;
      await client.deleteMulti(keys, { quiet: true });
      totalDeleted += keys.length;
      console.log(JSON.stringify({ batch: keys.length, totalDeleted }));
    }

    if (!result || !result.isTruncated) {
      break;
    }

    marker = result.nextMarker;
    if (!marker) {
      break;
    }
  }

  console.log(JSON.stringify({ prefix, totalFound, totalDeleted }));
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
