/**
 * create-bot-users.ts
 * 初始化 5 个 Bot 虚拟账号
 * 运行方式：npx tsx scripts/create-bot-users.ts
 *
 * 注意：需要设置好 DATABASE_URL 环境变量
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

// ============================================================
// 5 个虚拟账号定义
// ============================================================
const BOT_USERS = [
    {
        personaKey: 'bot_minimalist',
        personaName: '极简林同学',
        email: 'bot.minimalist@myteslab.internal',
        displayName: '极简林同学',
        styleFocus: '哑光素色、原厂升级感、低调奢华',
        avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=minimalist&backgroundColor=b6e3f4',
    },
    {
        personaKey: 'bot_cyber',
        personaName: '赛博阿浩',
        email: 'bot.cyber@myteslab.internal',
        displayName: '赛博阿浩',
        styleFocus: '碳纤维、荧光色、战斗拉花、性能感',
        avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=cyber&backgroundColor=1a1a2e',
    },
    {
        personaKey: 'bot_cream',
        personaName: '奶油Mia',
        email: 'bot.cream@myteslab.internal',
        displayName: '奶油Mia',
        styleFocus: '马卡龙色系、奶油白、温柔女性视角',
        avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=cream&backgroundColor=ffd6e7',
    },
    {
        personaKey: 'bot_collab',
        personaName: '联名猎人',
        email: 'bot.collab@myteslab.internal',
        displayName: '联名猎人',
        styleFocus: '二次元、跨界品牌联名、潮流文化',
        avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=collab&backgroundColor=ffd700',
    },
    {
        personaKey: 'bot_outdoor',
        personaName: '野路子',
        email: 'bot.outdoor@myteslab.internal',
        displayName: '野路子',
        styleFocus: 'Model Y越野户外、大地色、探险感',
        avatarUrl: 'https://api.dicebear.com/7.x/personas/svg?seed=outdoor&backgroundColor=a8d5a2',
    },
];

const INITIAL_CREDITS = 9999;

async function main() {
    const client = await pool.connect();
    console.log('🤖 开始创建 Bot 虚拟账号...\n');

    try {
        await client.query('BEGIN');

        for (const bot of BOT_USERS) {
            // 检查是否已存在
            const { rows: existing } = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [bot.email]
            );

            if (existing.length > 0) {
                console.log(`⏭️  ${bot.personaName} (${bot.email}) 已存在，跳过`);
                continue;
            }

            // 生成一个随机强密码（Bot 账号不需要人工登录）
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const passwordHash = await bcrypt.hash(randomPassword, 10);

            // 插入 users 表，直接标记为已验证
            const { rows: userRows } = await client.query(
                `INSERT INTO users
                    (email, password_hash, display_name, avatar_url, role, email_verified_at)
                 VALUES ($1, $2, $3, $4, 'bot_creator', NOW())
                 RETURNING id`,
                [bot.email, passwordHash, bot.displayName, bot.avatarUrl]
            );
            const userId = userRows[0].id;

            // 插入 profiles 表
            await client.query(
                `INSERT INTO profiles (id, email, display_name, avatar_url, role)
                 VALUES ($1, $2, $3, $4, 'bot_creator')
                 ON CONFLICT (id) DO NOTHING`,
                [userId, bot.email, bot.displayName, bot.avatarUrl]
            );

            // 初始化积分（充值 9999）
            await client.query(
                `INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
                 VALUES ($1, $2, $2, 0)
                 ON CONFLICT (user_id) DO UPDATE
                 SET balance = EXCLUDED.balance, total_earned = EXCLUDED.total_earned`,
                [userId, INITIAL_CREDITS]
            );

            // 写入 bot_virtual_users 元信息表
            await client.query(
                `INSERT INTO bot_virtual_users (user_id, persona_name, persona_key, style_focus)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (persona_key) DO NOTHING`,
                [userId, bot.personaName, bot.personaKey, bot.styleFocus]
            );

            console.log(`✅ 创建成功：${bot.personaName} (${bot.email}) → user_id: ${userId}`);
        }

        await client.query('COMMIT');
        console.log('\n🎉 所有 Bot 账号创建完毕！');

        // 输出汇总
        const { rows: summary } = await client.query(
            `SELECT u.id, u.email, u.display_name, bvu.persona_key, uc.balance
             FROM users u
             JOIN bot_virtual_users bvu ON bvu.user_id = u.id
             LEFT JOIN user_credits uc ON uc.user_id = u.id
             ORDER BY bvu.persona_key`
        );
        console.log('\n📋 Bot 账号汇总：');
        console.table(summary);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ 创建失败，已回滚：', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
