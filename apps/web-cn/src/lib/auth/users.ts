import { dbQuery } from '@/lib/db';
import { notifyAdminOfNewUser } from '@/lib/utils/admin';
import { getCreditRulesSnapshot } from '@/lib/credits/rules';

export type DbUser = {
    id: string;
    email: string | null;
    phone: string | null;
    password_hash: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
    email_verified_at: string | null;
    verification_token: string | null;
    verification_sent_at: string | null;
    union_id?: string | null;
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
    verificationToken?: string | null;
}) {
    const { email, phone, passwordHash, displayName, avatarUrl, verificationToken } = params;
    const { rows } = await dbQuery<DbUser>(
        `INSERT INTO users (email, phone, password_hash, display_name, avatar_url, verification_token, verification_sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
            email || null,
            phone || null,
            passwordHash || null,
            displayName || null,
            avatarUrl || null,
            verificationToken || null,
            verificationToken ? new Date().toISOString() : null
        ]
    );
    const user = rows[0] || null;

    if (user) {
        let registrationEnabled = true;
        let registrationCredits = 30;
        try {
            const rules = await getCreditRulesSnapshot();
            registrationEnabled = rules.registration_enabled;
            registrationCredits = rules.registration_credits;
        } catch (err) {
            console.error('[Auth] Failed to load credit rules, fallback to defaults:', err);
        }

        const giftCredits = registrationEnabled ? Math.max(0, registrationCredits) : 0;

        await dbQuery(
            `INSERT INTO profiles (id, email, display_name, avatar_url, role)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO NOTHING`,
            [user.id, user.email, user.display_name, user.avatar_url, user.role || 'user']
        );

        await dbQuery(
            `INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
             VALUES ($1, $2, $2, 0)
             ON CONFLICT (user_id) DO NOTHING`,
            [user.id, giftCredits]
        );

        if (giftCredits > 0) {
            await dbQuery(
                `INSERT INTO credit_ledger (user_id, amount, type, description, metadata)
                 VALUES ($1, $2, 'system_reward', 'New user registration reward', $3::jsonb)`,
                [user.id, giftCredits, JSON.stringify({ source: 'new_user_signup' })]
            );
        }

        // 异步发送新用户通知，不阻塞主流程
        notifyAdminOfNewUser({
            id: user.id,
            email: user.email,
            displayName: user.display_name
        }).catch(err => console.error('[Auth] Failed to send new user notification:', err));
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
        `SELECT u.*, i.union_id
         FROM user_identities i
         JOIN users u ON u.id = i.user_id
         WHERE i.provider = 'wechat' AND (i.provider_user_id = $1 OR i.openid_mp = $1)
         LIMIT 1`,
        [openId]
    );
    return rows[0] || null;
}

export async function findUserByWechatUnionId(unionId: string) {
    const { rows } = await dbQuery<DbUser>(
        `SELECT u.*
         FROM user_identities i
         JOIN users u ON u.id = i.user_id
         WHERE i.provider = 'wechat' AND i.union_id = $1
         LIMIT 1`,
        [unionId]
    );
    return rows[0] || null;
}

export async function linkWechatMPIdentity(userId: string, openIdMp: string, unionId?: string | null) {
    // Try to find existing identity record for this user and provider
    const { rows: existing } = await dbQuery(
        `SELECT * FROM user_identities WHERE user_id = $1 AND provider = 'wechat'`,
        [userId]
    );

    if (existing.length > 0) {
        // Update existing record
        await dbQuery(
            `UPDATE user_identities 
             SET openid_mp = $1, provider_user_id = COALESCE(provider_user_id, $1), union_id = COALESCE(union_id, $2)
             WHERE user_id = $3 AND provider = 'wechat'`,
            [openIdMp, unionId || null, userId]
        );
    } else {
        // Insert new record
        await dbQuery(
            `INSERT INTO user_identities (user_id, provider, provider_user_id, openid_mp, union_id)
             VALUES ($1, 'wechat', $2, $2, $3)
             ON CONFLICT (provider, provider_user_id) DO NOTHING`,
            [userId, openIdMp, unionId || null]
        );
    }
}

export async function verifyEmailByToken(token: string) {
    // 查找并更新用户
    const { rows } = await dbQuery<DbUser>(
        `UPDATE users 
         SET email_verified_at = NOW(), verification_token = NULL 
         WHERE verification_token = $1 
         AND (verification_sent_at > NOW() - INTERVAL '24 hours')
         RETURNING *`,
        [token]
    );
    return rows[0] || null;
}

export async function updateVerificationToken(userId: string, token: string) {
    await dbQuery(
        `UPDATE users 
         SET verification_token = $1, verification_sent_at = NOW() 
         WHERE id = $2`,
        [token, userId]
    );
}

/**
 * Atomic update for user profile information across both 'users' and 'profiles' tables.
 * This ensures consistency for navbar (from users) and profile page (from profiles).
 */
export async function updateUserInfo(userId: string, params: {
    displayName?: string | null;
    avatarUrl?: string | null;
}) {
    const { displayName, avatarUrl } = params;

    // 1. Prepare dynamic SQL for both tables
    const updates: string[] = [];
    const values: Array<string | null> = [userId];
    let placeholderIdx = 2;

    if (displayName !== undefined) {
        updates.push(`display_name = $${placeholderIdx++}`);
        values.push(displayName);
    }
    if (avatarUrl !== undefined) {
        updates.push(`avatar_url = $${placeholderIdx++}`);
        values.push(avatarUrl);
    }

    if (updates.length === 0) return;

    const setClause = updates.join(', ');

    // 2. Perform updates in parallel (or consider transaction for strict consistency)
    await Promise.all([
        dbQuery(
            `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1`,
            values
        ),
        dbQuery(
            `UPDATE profiles SET ${setClause}, updated_at = NOW() WHERE id = $1`,
            values
        )
    ]);
}
