const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL or POSTGRES_URL env var');
  console.log('Please run the following SQL in Supabase SQL Editor:');
  console.log(fs.readFileSync(path.join(__dirname, 'add_3d_model_fields.sql'), 'utf8'));
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  const client = await pool.connect();

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'add_3d_model_fields.sql'), 'utf8');

    console.log('Running migration...\n');

    await client.query(sql);

    console.log('✅ Migration completed successfully');
  } catch (error) {
    if (error.code === '42701') {
      console.log('⚠️  Fields already exist, skipping...');
    } else {
      console.error('Migration failed:', error.message);
      console.log('\nPlease run the following SQL in Supabase SQL Editor:');
      console.log(fs.readFileSync(path.join(__dirname, 'add_3d_model_fields.sql'), 'utf8'));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
