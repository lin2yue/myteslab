const { Pool } = require('pg');

const connectionString = 'postgresql://tewan:crystal*2@pgm-2zeum4kehtj5049x2o.pg.rds.aliyuncs.com:5432/tewan_web_cn';

const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
});

async function check() {
    console.log('Connecting to RDS...');
    try {
        const client = await pool.connect();
        console.log('Connected successfully!');

        const wrapCount = await client.query('SELECT count(*) FROM wraps');
        console.log('Wraps count:', wrapCount.rows[0].count);

        const modelCount = await client.query('SELECT count(*) FROM wrap_models');
        console.log('Model count:', modelCount.rows[0].count);

        const publicWraps = await client.query('SELECT count(*) FROM wraps WHERE is_public = true AND is_active = true');
        console.log('Public & Active Wraps count:', publicWraps.rows[0].count);

        client.release();
    } catch (err) {
        console.error('Connection failed:', err.message);
    } finally {
        await pool.end();
    }
}

check();
