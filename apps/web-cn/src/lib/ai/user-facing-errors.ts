const GENERIC_GENERATION_ERROR = '生成失败，请稍后重试。';
const GENERATION_TIMEOUT_ERROR = '生成超时，请稍后重试。';
const GENERATION_PROMPT_ADJUST_ERROR = '生成失败，请调整描述或参考图后重试。';

export function sanitizeUserFacingGenerationError(input: unknown, fallback = GENERIC_GENERATION_ERROR): string {
    const message = String(input || '').replace(/\s+/g, ' ').trim();
    if (!message) return fallback;

    const lower = message.toLowerCase();

    if (
        lower.includes('timeout')
        || message.includes('超时')
    ) {
        return GENERATION_TIMEOUT_ERROR;
    }

    if (
        lower.includes('safety')
        || lower.includes('blocklist')
        || lower.includes('prohibited_content')
        || lower.includes('recitation')
        || lower.includes('language')
        || message.includes('内容限制')
        || message.includes('安全策略')
        || message.includes('策略拦截')
        || message.includes('版权引用限制')
        || message.includes('提示词')
        || message.includes('参考图')
    ) {
        return GENERATION_PROMPT_ADJUST_ERROR;
    }

    if (
        lower.includes('gemini')
        || lower.includes('api key')
        || lower.includes('reported as leaked')
        || lower.includes('generativelanguage.googleapis.com')
        || lower.includes('responseid=')
        || lower.includes('modelversion=')
        || lower.includes('http 4')
        || lower.includes('http 5')
        || lower.includes('api error')
        || lower.includes('google')
    ) {
        return GENERIC_GENERATION_ERROR;
    }

    if (
        message.includes('未返回图片')
        || lower.includes('no image')
        || lower.includes('image_other')
        || lower.includes('api 服务暂时不可用')
        || lower.includes('ai generation failed')
        || lower.includes('task failed')
    ) {
        return GENERIC_GENERATION_ERROR;
    }

    return message;
}

export {
    GENERIC_GENERATION_ERROR,
    GENERATION_PROMPT_ADJUST_ERROR,
    GENERATION_TIMEOUT_ERROR
};
