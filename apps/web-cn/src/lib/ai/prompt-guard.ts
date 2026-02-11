type ProtectedIpRule = {
    term: string;
    pattern: RegExp;
    styleHint: string;
};

const PROTECTED_IP_RULES: ProtectedIpRule[] = [
    { term: '蜘蛛侠', pattern: /(蜘蛛侠|spider[\s-]?man)/i, styleHint: '红蓝撞色、蛛网几何、都市疾速动感' },
    { term: '钢铁侠', pattern: /(钢铁侠|iron[\s-]?man)/i, styleHint: '金红金属质感、科幻能量线条、机械装甲氛围' },
    { term: '漫威', pattern: /(漫威|marvel|复仇者联盟|avengers)/i, styleHint: '高对比超级英雄气质、电影级光影张力' },
    { term: '蝙蝠侠', pattern: /(蝙蝠侠|batman|哥谭|gotham)/i, styleHint: '暗夜城市、硬朗轮廓、低饱和高对比' },
    { term: '超人', pattern: /(超人|superman)/i, styleHint: '强力量感、流线光束、经典英勇氛围' },
    { term: '星球大战', pattern: /(星球大战|star[\s-]?wars|绝地|jedi)/i, styleHint: '未来战场、能量光刃、宇宙科技风' },
    { term: '变形金刚', pattern: /(变形金刚|transformers|博派|狂派)/i, styleHint: '机甲拼接、机械纹理、未来工业风' },
    { term: '宝可梦', pattern: /(宝可梦|神奇宝贝|pokemon|皮卡丘|pikachu)/i, styleHint: '亮色卡通电能感、圆润图形、轻快节奏' },
    { term: '高达', pattern: /(高达|gundam)/i, styleHint: '机甲层级结构、冷暖金属面、战术科技感' },
    { term: '迪士尼', pattern: /(迪士尼|disney|米老鼠|mickey|唐老鸭|donald)/i, styleHint: '童话色彩、柔和曲线、梦幻氛围' },
    { term: 'Hello Kitty', pattern: /(hello\s*kitty|凯蒂猫)/i, styleHint: '粉白主色、简洁萌系元素、柔和图案' },
    { term: '哆啦A梦', pattern: /(哆啦A梦|doraemon)/i, styleHint: '蓝白圆润卡通感、简洁未来道具氛围' },
];

const DIRECT_REPLICATION_PATTERNS = [
    /一模一样|1[:：]1|完全复刻|精确复刻|同款|官方原版|电影海报|官方海报|原画/i,
    /exact\s*copy|identical|same\s+as\s+movie|movie\s+poster|official\s+logo/i,
    /logo|商标|品牌标志|品牌logo|联名logo/i,
];

const MAX_EFFECTIVE_PROMPT_LENGTH = 320;

export type PromptGuardAction = 'allow' | 'rewrite' | 'reject';

export type PromptGuardResult = {
    action: PromptGuardAction;
    originalPrompt: string;
    effectivePrompt: string;
    matchedTerms: string[];
    reasonCode: 'none' | 'protected_ip_rewrite' | 'protected_ip_reject';
    userMessage?: string;
};

function dedupe<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

function compactPrompt(input: string): string {
    return input
        .replace(/[，,]{2,}/g, '，')
        .replace(/[。\.]{2,}/g, '。')
        .replace(/\s+/g, ' ')
        .replace(/[，,。\s]+$/g, '')
        .trim();
}

function trimToMax(input: string, max: number): string {
    if (input.length <= max) return input;
    return input.slice(0, max).trim();
}

export function evaluatePromptForGeneration(prompt: string): PromptGuardResult {
    const originalPrompt = compactPrompt(prompt);
    const matchedRules = PROTECTED_IP_RULES.filter(rule => rule.pattern.test(originalPrompt));
    const matchedTerms = dedupe(matchedRules.map(rule => rule.term));

    if (matchedTerms.length === 0) {
        return {
            action: 'allow',
            originalPrompt,
            effectivePrompt: originalPrompt,
            matchedTerms: [],
            reasonCode: 'none',
        };
    }

    const hasDirectReplicationIntent = DIRECT_REPLICATION_PATTERNS.some(rule => rule.test(originalPrompt));
    if (hasDirectReplicationIntent) {
        return {
            action: 'reject',
            originalPrompt,
            effectivePrompt: originalPrompt,
            matchedTerms,
            reasonCode: 'protected_ip_reject',
            userMessage: '提示词涉及受保护IP并包含复刻/Logo诉求，系统已拦截。请改为原创风格描述（仅保留配色、材质和氛围）。',
        };
    }

    let rewrittenBase = originalPrompt;
    for (const rule of matchedRules) {
        rewrittenBase = rewrittenBase.replace(rule.pattern, ' ');
    }
    rewrittenBase = compactPrompt(rewrittenBase);

    const styleHints = dedupe(matchedRules.map(rule => rule.styleHint));
    const rewritten = compactPrompt([
        rewrittenBase || '高对比原创英雄科幻主题车贴',
        styleHints.length > 0 ? `风格方向：${styleHints.join('；')}` : '',
        '仅保留色彩、材质与氛围，不出现任何现有IP角色、品牌标识、文字logo或可识别版权元素，必须原创设计',
    ].filter(Boolean).join('。'));

    return {
        action: 'rewrite',
        originalPrompt,
        effectivePrompt: trimToMax(rewritten, MAX_EFFECTIVE_PROMPT_LENGTH),
        matchedTerms,
        reasonCode: 'protected_ip_rewrite',
        userMessage: `检测到受保护IP关键词（${matchedTerms.join('、')}），已自动改写为原创风格描述后继续生成。`,
    };
}
