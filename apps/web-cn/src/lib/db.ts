import { Pool, QueryResultRow } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn('[DB] Missing DATABASE_URL env var.');
}

const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSLMODE === 'require'
        ? { rejectUnauthorized: false }
        : undefined,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_POOL_IDLE_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PG_POOL_CONN_MS || 5000),
});

export async function dbQuery<T extends QueryResultRow = any>(text: string, params: any[] = []) {
    const client = await pool.connect();
    try {
        return await client.query<T>(text, params);
    } finally {
        client.release();
    }
}

export function db() {
    return pool;
}
