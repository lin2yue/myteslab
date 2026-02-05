const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://tewan:crystal*2@pgm-2zeum4kehtj5049x.pg.rds.aliyuncs.com:5432/tewan_web_cn",
    ssl: { rejectUnauthorized: false }
});

async function findWrap() {
    try {
        const res = await pool.query("SELECT id, name, texture_url, model_slider_id, created_at FROM wraps ORDER BY created_at DESC LIMIT 10");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

findWrap();
