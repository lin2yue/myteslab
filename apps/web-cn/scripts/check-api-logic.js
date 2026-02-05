const { Pool } = require('pg');

const connectionString = 'postgresql://tewan:crystal*2@pgm-2zeum4kehtj5049x2o.pg.rds.aliyuncs.com:5432/tewan_web_cn';

const pool = new Pool({
    connectionString,
});

async function check() {
    const modelSlug = undefined;
    const page = 1;
    const pageSize = 12;
    const sortBy = 'latest';
    const from = (page - 1) * pageSize;

    const params = [];
    let where = 'w.is_public = true AND w.is_active = true';
    if (modelSlug) {
        params.push(modelSlug);
        where += ` AND w.model_slug = $${params.length}`;
    }
    const orderBy = sortBy === 'popular' ? 'w.download_count DESC' : 'w.created_at DESC';
    params.push(pageSize);
    const limitParam = `$${params.length}`;
    params.push(from);
    const offsetParam = `$${params.length}`;

    const sql = `
      SELECT
          w.id,
          w.slug,
          w.name,
          w.name_en,
          w.prompt,
          w.category,
          w.preview_url,
          w.model_slug,
          w.user_id,
          w.download_count,
          w.is_public,
          w.is_active,
          w.created_at,
          p.display_name AS profile_display_name,
          p.avatar_url AS profile_avatar_url
      FROM wraps w
      LEFT JOIN profiles p ON p.id = w.user_id
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
  `;

    console.log('Running query...');
    try {
        const { rows } = await pool.query(sql, params);
        console.log('Query returned rows:', rows.length);
        if (rows.length > 0) {
            console.log('First row name:', rows[0].name);
        }
    } catch (err) {
        console.error('Query failed:', err.message);
    } finally {
        await pool.end();
    }
}

check();
