import { dbQuery } from '@/lib/db';

export type DbUser = {
    id: string;
    email: string | null;
    phone: string | null;
    password_hash: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
};

export async function getUserByEmail(email: string) {
    const { rows } = await dbQuery<DbUser>(
        'SELECT * FROM users WHERE email = $1 LIMIT 1',
        [email]
    );
    return rows[0] || null;
}

export async function getUserByPhone(phone: string) {
    const { rows } = await dbQuery<DbUser>(
        'SELECT * FROM users WHERE phone = $1 LIMIT 1',
        [phone]
    );
    return rows[0] || null;
}

export async function getUserById(id: string) {
    const { rows } = await dbQuery<DbUser>(
        'SELECT * FROM users WHERE id = $1 LIMIT 1',
        [id]
    );
    return rows[0] || null;
}

export async function createUser(params: {
    email?: string | null;
    phone?: string | null;
    passwordHash?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
}) {
    const { email, phone, passwordHash, displayName, avatarUrl } = params;
    const { rows } = await dbQuery<DbUser>(
        `INSERT INTO users (email, phone, password_hash, display_name, avatar_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [email || null, phone || null, passwordHash || null, displayName || null, avatarUrl || null]
    );
    const user = rows[0] || null;

    if (user) {
        await dbQuery(
            `INSERT INTO profiles (id, email, display_name, avatar_url, role)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO NOTHING`,
            [user.id, user.email, user.display_name, user.avatar_url, user.role || 'user']
        );

        await dbQuery(
            `INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
             VALUES ($1, 30, 30, 0)
             ON CONFLICT (user_id) DO NOTHING`,
            [user.id]
        );
    }

    return user;
}

export async function linkWechatIdentity(userId: string, openId: string, unionId?: string | null) {
    await dbQuery(
        `INSERT INTO user_identities (user_id, provider, provider_user_id, union_id)
         VALUES ($1, 'wechat', $2, $3)
         ON CONFLICT (provider, provider_user_id) DO NOTHING`,
        [userId, openId, unionId || null]
    );
}

export async function findUserByWechatOpenId(openId: string) {
    const { rows } = await dbQuery<DbUser>(
        `SELECT u.*
         FROM user_identities i
         JOIN users u ON u.id = i.user_id
         WHERE i.provider = 'wechat' AND i.provider_user_id = $1
         LIMIT 1`,
        [openId]
    );
    return rows[0] || null;
}
