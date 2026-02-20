/**
 * Bot 虚拟账号配置
 * 对应数据库 bot_virtual_users 表
 * 账号初始化：scripts/create-bot-users.ts
 */

export type BotPersonaKey =
    | 'bot_minimalist'
    | 'bot_cyber'
    | 'bot_cream'
    | 'bot_collab'
    | 'bot_outdoor';

export interface BotUser {
    userId: string;
    personaKey: BotPersonaKey;
    personaName: string;
    styleFocus: string;
    preferredModelSlugs: string[];  // 该人格擅长的车型
}

export const BOT_USERS: BotUser[] = [
    {
        userId: '1a12027a-b12b-452b-9fb2-142e703974e1',
        personaKey: 'bot_minimalist',
        personaName: '极简林同学',
        styleFocus: '哑光素色、原厂升级感、低调奢华',
        preferredModelSlugs: ['model-3', 'model-3-2024'],
    },
    {
        userId: '5c105ff9-2aaf-4301-966d-2f7f9c759513',
        personaKey: 'bot_cyber',
        personaName: '赛博阿浩',
        styleFocus: '碳纤维、荧光色、战斗拉花、性能感',
        preferredModelSlugs: ['cybertruck', 'model-3'],
    },
    {
        userId: '26d3194a-345a-4087-a0cf-8200ea94dd8e',
        personaKey: 'bot_cream',
        personaName: '奶油Mia',
        styleFocus: '马卡龙色系、奶油白、温柔女性视角',
        preferredModelSlugs: ['model-y', 'model-y-2025-standard'],
    },
    {
        userId: 'a364bebf-a80d-4819-8c95-e4db3a325a70',
        personaKey: 'bot_collab',
        personaName: '联名猎人',
        styleFocus: '二次元、跨界品牌联名、潮流文化',
        preferredModelSlugs: ['model-3-2024', 'model-y'],
    },
    {
        userId: '4a5858ce-71ce-4297-aa38-cfc380dbc674',
        personaKey: 'bot_outdoor',
        personaName: '野路子',
        styleFocus: 'Model Y越野户外、大地色、探险感',
        preferredModelSlugs: ['model-y', 'model-y-2025-standard'],
    },
];

/** 按 personaKey 查找 */
export function getBotUser(personaKey: BotPersonaKey): BotUser | undefined {
    return BOT_USERS.find(u => u.personaKey === personaKey);
}

/** 随机选一个 Bot 用户（用于分散发布） */
export function getRandomBotUser(): BotUser {
    return BOT_USERS[Math.floor(Math.random() * BOT_USERS.length)];
}

/** 按车型偏好选 Bot 用户 */
export function getBotUserForModel(modelSlug: string): BotUser {
    const preferred = BOT_USERS.filter(u => u.preferredModelSlugs.includes(modelSlug));
    const pool = preferred.length > 0 ? preferred : BOT_USERS;
    return pool[Math.floor(Math.random() * pool.length)];
}
