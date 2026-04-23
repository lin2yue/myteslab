import { dbQuery } from '@/lib/db';

let ensured = false;

export async function ensureTewanMpLogTables() {
    if (ensured) return;

    await dbQuery(`
        CREATE TABLE IF NOT EXISTS tewan_mp_message_logs (
            id BIGSERIAL PRIMARY KEY,
            source_account TEXT NOT NULL DEFAULT 'tewan',
            openid TEXT NOT NULL,
            direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
            msg_type TEXT NOT NULL,
            event TEXT NULL,
            event_key TEXT NULL,
            msg_id TEXT NULL,
            dedup_key TEXT NULL,
            content TEXT NULL,
            reply_strategy TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_tewan_mp_message_logs_created_at ON tewan_mp_message_logs(created_at DESC)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_tewan_mp_message_logs_openid ON tewan_mp_message_logs(openid)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_tewan_mp_message_logs_direction ON tewan_mp_message_logs(direction)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_tewan_mp_message_logs_msg_id ON tewan_mp_message_logs(msg_id)`);

    ensured = true;
}

export async function logTewanMpMessage(params: {
    openid: string;
    direction: 'inbound' | 'outbound';
    msgType: string;
    event?: string | null;
    eventKey?: string | null;
    msgId?: string | null;
    dedupKey?: string | null;
    content?: string | null;
    replyStrategy?: string | null;
    sourceAccount?: string | null;
}) {
    await ensureTewanMpLogTables();
    await dbQuery(
        `INSERT INTO tewan_mp_message_logs (
            source_account, openid, direction, msg_type, event, event_key, msg_id, dedup_key, content, reply_strategy
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
            params.sourceAccount || 'tewan',
            params.openid,
            params.direction,
            params.msgType,
            params.event || null,
            params.eventKey || null,
            params.msgId || null,
            params.dedupKey || null,
            params.content || null,
            params.replyStrategy || null,
        ]
    );
}
