const { createClient } = require('../node_modules/@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildSlugBase({ name, name_en, prompt, model_slug }) {
  const raw = name_en || name || prompt || 'wrap';
  const base = slugify(raw);
  if (base) return model_slug ? `${model_slug}-${base}` : base;
  const fallback = `wrap-${crypto.randomBytes(3).toString('hex')}`;
  return model_slug ? `${model_slug}-${fallback}` : fallback;
}

async function ensureUniqueSlug(base) {
  let candidate = base;
  for (let i = 0; i < 5; i += 1) {
    const { data, error } = await supabase.from('wraps').select('id').eq('slug', candidate).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return candidate;
    candidate = `${base}-${crypto.randomBytes(2).toString('hex')}`;
  }
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

async function run() {
  let updated = 0;
  let page = 0;
  const pageSize = 100;

  while (true) {
    const { data, error } = await supabase
      .from('wraps')
      .select('id,slug,name,name_en,prompt,model_slug')
      .or('slug.is.null,slug.eq.')
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      const base = buildSlugBase(row);
      const slug = await ensureUniqueSlug(base);
      const { error: updateError } = await supabase
        .from('wraps')
        .update({ slug })
        .eq('id', row.id);
      if (updateError) throw updateError;
      updated += 1;
    }

    page += 1;
  }

  console.log(`Backfill complete. Updated ${updated} rows.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
