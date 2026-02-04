import { cookies, headers } from 'next/headers';
import { randomBytes, createHash } from 'crypto';
import { dbQuery } from '@/lib/db';
import { SESSION_COOKIE_NAME, SESSION_TTL_DAYS } from './constants';

function hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
}

export type SessionUser = {
    id: string;
    email: string | null;
    phone: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
};

export async function createSession(userId: string) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const ua = hdrs.get('user-agent');

    await dbQuery(
        `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, tokenHash, expiresAt, ip, ua]
    );

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        expires: expiresAt,
    });
}

export async function clearSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
        const tokenHash = hashToken(token);
        await dbQuery('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    }
    cookieStore.set(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        expires: new Date(0),
    });
}

export async function getSessionUser(): Promise<SessionUser | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    const tokenHash = hashToken(token);

    const { rows } = await dbQuery<SessionUser>(
        `SELECT u.id, u.email, u.phone, u.display_name, u.avatar_url, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()
         LIMIT 1`,
        [tokenHash]
    );

    return rows[0] || null;
}

export async function getSessionUserByToken(token: string): Promise<SessionUser | null> {
    const tokenHash = hashToken(token);
    const { rows } = await dbQuery<SessionUser>(
        `SELECT u.id, u.email, u.phone, u.display_name, u.avatar_url, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()
         LIMIT 1`,
        [tokenHash]
    );
    return rows[0] || null;
}

export { hashToken };
