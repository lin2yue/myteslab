/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const envFile = process.argv[2] || '.env.local';
const envPath = path.resolve(__dirname, '..', envFile);
const dryRun = process.argv.includes('--dry-run');

console.log('Loading environment from:', envPath);
if (!fs.existsSync(envPath)) {
    console.error(`Env file not found: ${envPath}`);
    process.exit(1);
}
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const sslMode = process.env.PGSSLMODE;

function createPool(withSsl) {
    return new Pool({
        connectionString: databaseUrl,
        ssl: withSsl ? { rejectUnauthorized: false } : false,
    });
}

let pool = createPool(Boolean(sslMode && sslMode !== 'disable'));

const OFFICIAL_CATEGORY = 'official';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeUuid(value) {
    if (typeof value === 'string' && UUID_RE.test(value)) return value;
    const raw = String(value ?? '');
    const padded = raw.length >= 12 ? raw.slice(-12) : raw.padStart(12, '0');
    return `00000000-0000-0000-0000-${padded}`;
}

async function fetchAll(table, select, applyFilters) {
    const pageSize = 1000;
    let from = 0;
    const rows = [];
    while (true) {
        let query = supabase.from(table).select(select).order('id', { ascending: true });
        if (applyFilters) query = applyFilters(query);
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw new Error(`[supabase] ${table}: ${error.message}`);
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return rows;
}

async function upsertWrapModels(models) {
    if (!models.length) return 0;
    const sql = `
        INSERT INTO wrap_models (
            id, slug, name, name_en, manufacturer, model_3d_url, thumb_url, uv_note,
            is_active, sort_order, wheel_url, created_at, updated_at
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
        )
        ON CONFLICT (id) DO UPDATE SET
            slug = EXCLUDED.slug,
            name = EXCLUDED.name,
            name_en = EXCLUDED.name_en,
            manufacturer = EXCLUDED.manufacturer,
            model_3d_url = EXCLUDED.model_3d_url,
            thumb_url = EXCLUDED.thumb_url,
            uv_note = EXCLUDED.uv_note,
            is_active = EXCLUDED.is_active,
            sort_order = EXCLUDED.sort_order,
            wheel_url = EXCLUDED.wheel_url,
            updated_at = EXCLUDED.updated_at
    `;

    let count = 0;
    for (const m of models) {
        const values = [
            m.id,
            m.slug,
            m.name,
            m.name_en ?? null,
            m.manufacturer ?? 'Tesla',
            m.model_3d_url,
            m.thumb_url ?? null,
            m.uv_note ?? null,
            m.is_active ?? true,
            m.sort_order ?? 0,
            m.wheel_url ?? null,
            m.created_at ?? new Date().toISOString(),
            m.updated_at ?? new Date().toISOString(),
        ];
        if (!dryRun) await pool.query(sql, values);
        count += 1;
    }
    return count;
}

async function upsertWraps(wraps) {
    if (!wraps.length) return 0;
    const sql = `
        INSERT INTO wraps (
            id, user_id, slug, name, name_en, description, description_en, prompt, model_slug,
            texture_url, preview_url, thumb_url, thumbnail_url, author_id, author_name,
            category, tags, source, attribution, download_count, sort_order, is_public,
            is_active, reference_images, generation_task_id, deleted_at, created_at, updated_at
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,
            $10,$11,$12,$13,$14,$15,
            $16,$17,$18,$19,$20,$21,$22,
            $23,$24,$25,$26,$27,$28
        )
        ON CONFLICT (id) DO UPDATE SET
            slug = EXCLUDED.slug,
            name = EXCLUDED.name,
            name_en = EXCLUDED.name_en,
            description = EXCLUDED.description,
            description_en = EXCLUDED.description_en,
            prompt = EXCLUDED.prompt,
            model_slug = EXCLUDED.model_slug,
            texture_url = EXCLUDED.texture_url,
            preview_url = EXCLUDED.preview_url,
            thumb_url = EXCLUDED.thumb_url,
            thumbnail_url = EXCLUDED.thumbnail_url,
            author_id = EXCLUDED.author_id,
            author_name = EXCLUDED.author_name,
            category = EXCLUDED.category,
            tags = EXCLUDED.tags,
            source = EXCLUDED.source,
            attribution = EXCLUDED.attribution,
            download_count = EXCLUDED.download_count,
            sort_order = EXCLUDED.sort_order,
            is_public = EXCLUDED.is_public,
            is_active = EXCLUDED.is_active,
            reference_images = EXCLUDED.reference_images,
            deleted_at = EXCLUDED.deleted_at,
            updated_at = EXCLUDED.updated_at
    `;

    let count = 0;
    let skipped = 0;
    for (const w of wraps) {
        if (!w.texture_url || !w.preview_url) {
            skipped += 1;
            continue;
        }
        const values = [
            w.id,
            null, // do not bind user_id (no user migration)
            w.slug ?? w.id,
            w.name ?? w.prompt ?? 'Untitled Wrap',
            w.name_en ?? w.name ?? w.prompt ?? 'Untitled Wrap',
            w.description ?? null,
            w.description_en ?? null,
            w.prompt ?? null,
            w.model_slug ?? null,
            w.texture_url,
            w.preview_url,
            w.thumb_url ?? null,
            w.thumbnail_url ?? null,
            null,
            w.author_name ?? '特玩',
            w.category ?? OFFICIAL_CATEGORY,
            w.tags ?? null,
            w.source ?? null,
            w.attribution ?? null,
            w.download_count ?? 0,
            w.sort_order ?? 0,
            w.is_public ?? true,
            w.is_active ?? true,
            w.reference_images ?? null,
            null, // generation_task_id
            w.deleted_at ?? null,
            w.created_at ?? new Date().toISOString(),
            w.updated_at ?? new Date().toISOString(),
        ];
        if (!dryRun) await pool.query(sql, values);
        count += 1;
    }
    if (skipped > 0) {
        console.warn(`Skipped wraps missing texture/preview: ${skipped}`);
    }
    return count;
}

async function upsertWrapModelMap(rows, allowWrapIds) {
    if (!rows.length) return 0;
    const sql = `
        INSERT INTO wrap_model_map (
            id, model_id, wrap_id, is_default, created_at
        ) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET
            model_id = EXCLUDED.model_id,
            wrap_id = EXCLUDED.wrap_id,
            is_default = EXCLUDED.is_default,
            created_at = EXCLUDED.created_at
    `;
    let count = 0;
    for (const r of rows) {
        if (allowWrapIds && !allowWrapIds.has(r.wrap_id)) continue;
        const values = [
            r.id,
            r.model_id,
            r.wrap_id,
            r.is_default ?? false,
            r.created_at ?? new Date().toISOString(),
        ];
        if (!dryRun) await pool.query(sql, values);
        count += 1;
    }
    return count;
}

async function upsertBanners(rows) {
    if (!rows.length) return 0;
    const sql = `
        INSERT INTO banners (
            id, title, image_url, target_path, sort_order, is_active, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            image_url = EXCLUDED.image_url,
            target_path = EXCLUDED.target_path,
            sort_order = EXCLUDED.sort_order,
            is_active = EXCLUDED.is_active,
            created_at = EXCLUDED.created_at
    `;
    let count = 0;
    for (const b of rows) {
        const values = [
            normalizeUuid(b.id),
            b.title ?? null,
            b.image_url,
            b.target_path ?? null,
            b.sort_order ?? 0,
            b.is_active ?? true,
            b.created_at ?? new Date().toISOString(),
        ];
        if (!dryRun) await pool.query(sql, values);
        count += 1;
    }
    return count;
}

async function upsertAudios(rows) {
    if (!rows.length) return 0;
    const sql = `
        INSERT INTO audios (
            id, title, album, file_url, cover_url, duration, tags, play_count, download_count, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            album = EXCLUDED.album,
            file_url = EXCLUDED.file_url,
            cover_url = EXCLUDED.cover_url,
            duration = EXCLUDED.duration,
            tags = EXCLUDED.tags,
            play_count = EXCLUDED.play_count,
            download_count = EXCLUDED.download_count,
            created_at = EXCLUDED.created_at
    `;
    let count = 0;
    for (const a of rows) {
        const values = [
            normalizeUuid(a.id),
            a.title,
            a.album ?? null,
            a.file_url,
            a.cover_url ?? null,
            a.duration ?? null,
            a.tags ?? null,
            a.play_count ?? 0,
            a.download_count ?? 0,
            a.created_at ?? new Date().toISOString(),
        ];
        if (!dryRun) await pool.query(sql, values);
        count += 1;
    }
    return count;
}

async function main() {
    console.log('Dry run:', dryRun);
    console.log('Fetching data from Supabase...');

    const [models, banners, audios] = await Promise.all([
        fetchAll('wrap_models', 'id, slug, name, name_en, manufacturer, model_3d_url, thumb_url, uv_note, is_active, sort_order, wheel_url, created_at, updated_at'),
        fetchAll('banners', 'id, title, image_url, target_path, sort_order, is_active, created_at'),
        fetchAll('audios', 'id, title, album, file_url, cover_url, duration, tags, play_count, download_count, created_at'),
    ]);

    const wraps = await fetchAll(
        'wraps',
        'id, slug, name, name_en, description, description_en, prompt, model_slug, texture_url, preview_url, thumb_url, thumbnail_url, author_id, author_name, category, tags, source, attribution, download_count, sort_order, is_public, is_active, reference_images, deleted_at, created_at, updated_at',
        (q) => q.eq('category', OFFICIAL_CATEGORY)
    );

    const wrapModelMap = await fetchAll(
        'wrap_model_map',
        'id, model_id, wrap_id, is_default, created_at'
    );

    console.log('Supabase counts:', {
        wrap_models: models.length,
        wraps_official: wraps.length,
        wrap_model_map: wrapModelMap.length,
        banners: banners.length,
        audios: audios.length,
    });

    if (dryRun) {
        console.log('Dry run complete. No data written.');
        return;
    }

    console.log('Writing to RDS...');
    const officialWrapIds = new Set(wraps.map(w => w.id));

    const runInsertions = async () => {
        const insertedModels = await upsertWrapModels(models);
        const insertedWraps = await upsertWraps(wraps);
        const insertedMap = await upsertWrapModelMap(wrapModelMap, officialWrapIds);
        const insertedBanners = await upsertBanners(banners);
        const insertedAudios = await upsertAudios(audios);

        console.log('Migration complete:', {
            wrap_models: insertedModels,
            wraps: insertedWraps,
            wrap_model_map: insertedMap,
            banners: insertedBanners,
            audios: insertedAudios,
        });
    };

    try {
        await runInsertions();
    } catch (err) {
        const msg = String(err && err.message ? err.message : err);
        if (msg.includes('does not support SSL')) {
            console.warn('RDS does not support SSL. Retrying without SSL...');
            await pool.end();
            pool = createPool(false);
            await runInsertions();
        } else {
            throw err;
        }
    }
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await pool.end();
    });
