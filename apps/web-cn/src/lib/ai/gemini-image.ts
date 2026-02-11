import { buildWrapPrompt, getPromptVersionFromEnv } from './prompts';
import { getMaskDimensions } from './mask-config';
import dns from 'dns';

// 强制优先使用 IPv4, 防止容器 IPv6 路由缺失导致的秒级超时 (ETIMEDOUT)
if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

function readEnvInt(name: string, fallback: number): number {
    const raw = (process.env[name] || '').trim();
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
    return status === 408 || status === 409 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(error: any): boolean {
    if (!error) return false;
    if (error.name === 'AbortError') return true;
    if (typeof error.message === 'string' && error.message.includes('fetch failed')) return true;
    const cause: any = (error as any).cause;
    const code = cause?.code || error.code;
    return ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED'].includes(code);
}

async function fetchWithRetry(url: string, options: RequestInit & { timeoutMs: number; maxRetries: number; retryBaseMs: number; retryMaxMs: number; logPrefix?: string; }) {
    const { timeoutMs, maxRetries, retryBaseMs, retryMaxMs, logPrefix, ...rest } = options;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            if (attempt > 0 && logPrefix) {
                console.warn(`${logPrefix} Retry attempt ${attempt}/${maxRetries}`);
            }
            const response = await fetch(url, { ...rest, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok && attempt < maxRetries && isRetryableStatus(response.status)) {
                await response.text().catch(() => undefined);
                const delay = Math.min(retryMaxMs, Math.round(retryBaseMs * Math.pow(1.6, attempt)));
                await sleep(delay);
                continue;
            }
            return response;
        } catch (error: any) {
            clearTimeout(timeoutId);
            const retryable = isRetryableError(error);
            if (retryable && attempt < maxRetries) {
                const delay = Math.min(retryMaxMs, Math.round(retryBaseMs * Math.pow(1.6, attempt)));
                await sleep(delay);
                continue;
            }
            if (error?.name === 'AbortError') {
                throw new Error(`AI 生成超时 (超过 ${Math.round(timeoutMs / 1000)}s)`);
            }
            throw error;
        }
    }
    throw new Error('Retry attempts exhausted');
}

// Gemini API configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent';
const DEFAULT_IMAGE_FALLBACK_MODELS = ['gemini-2.5-flash-image'];

interface GenerateWrapParams {
    modelSlug: string;
    modelName: string;
    prompt: string;
    maskImageBase64?: string;
    referenceImagesBase64?: string[];
}

export interface GenerateWrapResult {
    success: boolean;
    imageBase64?: string;
    dataUrl?: string; // Standard data:image/png;base64,... format
    mimeType?: string;
    error?: string;
    errorCode?: string;
    usage?: any; // Token usage info if available
    finalPrompt?: string; // The exact prompt sent to AI
    finishReasons?: string[];
    finishMessages?: string[];
    promptBlockReason?: string | null;
    responseId?: string | null;
    modelVersion?: string | null;
}

type ParsedGeminiResult = {
    ok: boolean;
    result?: GenerateWrapResult;
    retryable: boolean;
    error?: string;
    errorCode?: string;
    finishReasons?: string[];
    finishMessages?: string[];
    promptBlockReason?: string | null;
    responseId?: string | null;
    modelVersion?: string | null;
};

type ParsedGeminiHttpError = {
    retryable: boolean;
    error: string;
    errorCode: string;
    promptBlockReason?: string | null;
    finishReasons?: string[];
    finishMessages?: string[];
    responseId?: string | null;
    modelVersion?: string | null;
};

const PROMPT_BLOCKED_REASONS = new Set(['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'IMAGE_SAFETY']);
const FINISH_POLICY_REASONS = new Set([
    'SAFETY',
    'BLOCKLIST',
    'PROHIBITED_CONTENT',
    'SPII',
    'IMAGE_SAFETY',
    'IMAGE_PROHIBITED_CONTENT'
]);
const FINISH_RETRYABLE_REASONS = new Set(['OTHER', 'IMAGE_OTHER', 'NO_IMAGE']);

function buildPromptBlockedMessage(blockReason: string): string {
    if (blockReason === 'PROHIBITED_CONTENT' || blockReason === 'BLOCKLIST') {
        return '生成失败：提示词触发了平台内容限制（违禁词/受限内容）。请修改提示词后重试。';
    }
    if (blockReason === 'SAFETY' || blockReason === 'IMAGE_SAFETY') {
        return '生成失败：提示词或参考图触发安全策略，请调整描述后重试。';
    }
    return `生成失败：请求被内容策略拦截（${blockReason}）。请调整提示词后重试。`;
}

function buildFinishReasonMessage(finishReasons: string[]): string {
    const joined = finishReasons.join(',');
    if (finishReasons.some(reason => FINISH_POLICY_REASONS.has(reason))) {
        return `生成失败：请求触发内容安全策略（${joined}）。请修改提示词后重试。`;
    }
    if (finishReasons.includes('RECITATION') || finishReasons.includes('IMAGE_RECITATION')) {
        return `生成失败：内容触发版权/引用限制（${joined}）。请尝试更原创的描述。`;
    }
    if (finishReasons.includes('LANGUAGE')) {
        return '生成失败：提示词语言不受支持，请改用中文或英文简化描述。';
    }
    if (finishReasons.includes('NO_IMAGE') || finishReasons.includes('IMAGE_OTHER') || finishReasons.includes('OTHER')) {
        return `生成失败：模型未返回图片（${joined}）。建议简化提示词或更换描述方式。`;
    }
    return `生成失败：模型返回异常结束状态（${joined}）。`;
}

function parseGeminiHttpError(status: number, rawBody: string): ParsedGeminiHttpError {
    let parsed: any = null;
    try {
        parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch {
        parsed = null;
    }

    const candidateFinishReasons = Array.isArray(parsed?.candidates)
        ? parsed.candidates.map((c: any) => String(c?.finishReason || '').toUpperCase()).filter(Boolean)
        : [];
    const candidateFinishMessages = Array.isArray(parsed?.candidates)
        ? parsed.candidates.map((c: any) => String(c?.finishMessage || '').trim()).filter(Boolean)
        : [];
    const responseId = typeof parsed?.responseId === 'string' ? parsed.responseId : null;
    const modelVersion = typeof parsed?.modelVersion === 'string' ? parsed.modelVersion : null;

    const message =
        parsed?.error?.message
        || parsed?.message
        || rawBody
        || `Gemini API Error (${status})`;

    const promptBlockReason = String(
        parsed?.promptFeedback?.blockReason
        || parsed?.error?.details?.[0]?.metadata?.blockReason
        || ''
    ).toUpperCase() || null;

    if (promptBlockReason && PROMPT_BLOCKED_REASONS.has(promptBlockReason)) {
        return {
            retryable: false,
            errorCode: 'prompt_blocked',
            error: buildPromptBlockedMessage(promptBlockReason),
            promptBlockReason,
            finishReasons: candidateFinishReasons,
            finishMessages: candidateFinishMessages,
            responseId,
            modelVersion,
        };
    }

    if (status === 429 || status === 408 || status >= 500) {
        return {
            retryable: true,
            errorCode: 'api_retryable_error',
            error: `AI 服务暂时不可用（HTTP ${status}），系统将自动重试。`,
            finishReasons: candidateFinishReasons,
            finishMessages: candidateFinishMessages,
            responseId,
            modelVersion,
        };
    }

    return {
        retryable: false,
        errorCode: 'api_error',
        error: `Gemini API Error (${status}): ${message}`.slice(0, 600),
        finishReasons: candidateFinishReasons,
        finishMessages: candidateFinishMessages,
        responseId,
        modelVersion,
    };
}

function extractInlineImagePart(payload: any): { mimeType: string; data: string } | null {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    for (const candidate of candidates) {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        for (const part of parts) {
            const inlineData = part?.inlineData || part?.inline_data;
            if (inlineData?.data) {
                return {
                    mimeType: inlineData?.mimeType || inlineData?.mime_type || 'image/png',
                    data: inlineData.data
                };
            }
        }
    }
    return null;
}

function extractTextPart(payload: any): string | null {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    for (const candidate of candidates) {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        for (const part of parts) {
            if (typeof part?.text === 'string' && part.text.trim()) {
                return part.text.trim();
            }
        }
    }
    return null;
}

function summarizeGeminiResponse(payload: any) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    return {
        promptBlockReason: payload?.promptFeedback?.blockReason || null,
        candidateCount: candidates.length,
        finishReasons: candidates.map((c: any) => c?.finishReason).filter(Boolean),
        finishMessages: candidates.map((c: any) => c?.finishMessage).filter(Boolean),
        responseId: payload?.responseId || null,
        modelVersion: payload?.modelVersion || null,
        candidatePartShapes: candidates.map((c: any) => {
            const parts = Array.isArray(c?.content?.parts) ? c.content.parts : [];
            return parts.map((p: any) => ({
                hasInlineData: Boolean(p?.inlineData || p?.inline_data),
                hasText: typeof p?.text === 'string',
                keys: Object.keys(p || {})
            }));
        })
    };
}

function parseGeminiImageResponse(payload: any, finalPrompt: string): ParsedGeminiResult {
    const usageMetadata = payload?.usageMetadata;
    const responseId = typeof payload?.responseId === 'string' ? payload.responseId : null;
    const modelVersion = typeof payload?.modelVersion === 'string' ? payload.modelVersion : null;
    const imagePart = extractInlineImagePart(payload);
    if (imagePart) {
        return {
            ok: true,
            retryable: false,
            result: {
                success: true,
                imageBase64: imagePart.data,
                dataUrl: `data:${imagePart.mimeType};base64,${imagePart.data}`,
                mimeType: imagePart.mimeType,
                usage: usageMetadata,
                finalPrompt,
                finishReasons: [],
                finishMessages: [],
                responseId,
                modelVersion,
                promptBlockReason: null
            }
        };
    }

    const summary = summarizeGeminiResponse(payload);
    const finishReasons: string[] = Array.isArray(summary.finishReasons)
        ? summary.finishReasons.map((x: any) => String(x).toUpperCase())
        : [];
    const finishMessages: string[] = Array.isArray(summary.finishMessages)
        ? summary.finishMessages.map((x: any) => String(x).trim()).filter(Boolean)
        : [];
    const promptBlockReason = summary.promptBlockReason ? String(summary.promptBlockReason).toUpperCase() : null;

    if (promptBlockReason) {
        return {
            ok: false,
            retryable: false,
            errorCode: 'prompt_blocked',
            promptBlockReason,
            finishReasons,
            finishMessages,
            responseId,
            modelVersion,
            error: buildPromptBlockedMessage(promptBlockReason)
        };
    }
    if (finishReasons.some(reason => FINISH_POLICY_REASONS.has(reason))) {
        return {
            ok: false,
            retryable: false,
            errorCode: 'prompt_blocked',
            finishReasons,
            finishMessages,
            promptBlockReason,
            responseId,
            modelVersion,
            error: buildFinishReasonMessage(finishReasons)
        };
    }
    if (finishReasons.includes('RECITATION') || finishReasons.includes('IMAGE_RECITATION')) {
        return {
            ok: false,
            retryable: false,
            errorCode: 'recitation_blocked',
            finishReasons,
            finishMessages,
            promptBlockReason,
            responseId,
            modelVersion,
            error: buildFinishReasonMessage(finishReasons)
        };
    }

    const textPart = extractTextPart(payload);
    if (textPart) {
        return {
            ok: false,
            retryable: true,
            errorCode: 'no_image_payload',
            finishReasons,
            finishMessages,
            promptBlockReason,
            responseId,
            modelVersion,
            error: `Model returned non-image response: ${textPart.substring(0, 200)}`
        };
    }

    console.warn('[AI-GEN] Gemini response has no image payload:', JSON.stringify(summary));
    let userFriendlyError = finishReasons.length > 0
        ? buildFinishReasonMessage(finishReasons)
        : '生成失败：模型未返回图片内容。请稍后重试。';

    return {
        ok: false,
        retryable: finishReasons.length === 0 || finishReasons.some(reason => FINISH_RETRYABLE_REASONS.has(reason)),
        errorCode: 'no_image_payload',
        finishReasons,
        finishMessages,
        promptBlockReason,
        responseId,
        modelVersion,
        error: userFriendlyError
    };
}

/**
 * Generate a wrap texture using Gemini's image generation
 */
export async function generateWrapTexture(
    params: GenerateWrapParams
): Promise<GenerateWrapResult> {
    const VERSION = "V1.1.1";
    const { modelSlug, modelName, prompt, maskImageBase64, referenceImagesBase64 } = params;

    const maskDimensions = getMaskDimensions(modelSlug);
    let textPrompt = '';

    try {
        const apiKey = (process.env.GEMINI_API_KEY || '').trim();
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not defined');
        }

        const promptVersion = getPromptVersionFromEnv();
        textPrompt = buildWrapPrompt({
            userPrompt: prompt,
            modelName,
            version: promptVersion,
            outputSize: { width: maskDimensions.width, height: maskDimensions.height }
        });

        const primaryModel = (process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview').trim();
        if (!primaryModel) {
            throw new Error('GEMINI_IMAGE_MODEL is empty');
        }
        const fallbackModelsFromEnv = (process.env.GEMINI_IMAGE_FALLBACK_MODELS || '')
            .split(',')
            .map(m => m.trim())
            .filter(Boolean)
            .filter(m => m !== primaryModel);
        const fallbackModels = fallbackModelsFromEnv.length > 0
            ? fallbackModelsFromEnv
            : DEFAULT_IMAGE_FALLBACK_MODELS.filter(m => m !== primaryModel);
        const modelCandidates = [primaryModel, ...fallbackModels];
        const apiBaseUrl = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').trim();
        const buildParts = (promptValue: string) => {
            const built: any[] = [];

            // Keep request layout aligned with main branch behavior:
            // mask first, then prompt text, then references.
            if (maskImageBase64) {
                const cleanMaskBase64 = maskImageBase64.includes('base64,')
                    ? maskImageBase64.split('base64,')[1]
                    : maskImageBase64;

                built.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: cleanMaskBase64
                    }
                });
            }

            built.push({ text: promptValue });

            if (referenceImagesBase64 && referenceImagesBase64.length > 0) {
                referenceImagesBase64.forEach((base64: string) => {
                    built.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64
                        }
                    });
                });
            }
            return built;
        };

        const imageTimeoutMs = readEnvInt('GEMINI_IMAGE_TIMEOUT_MS', 60000);
        const imageMaxRetries = readEnvInt('GEMINI_IMAGE_RETRIES', 2);
        const retryBaseMs = readEnvInt('GEMINI_RETRY_BASE_MS', 800);
        const retryMaxMs = readEnvInt('GEMINI_RETRY_MAX_MS', 5000);
        const imageSize = (process.env.GEMINI_IMAGE_SIZE || '').trim();
        const noImageRetryRounds = Math.min(readEnvInt('GEMINI_NO_IMAGE_RETRY_ROUNDS', 0), 3);
        const maxTotalMs = readEnvInt('GEMINI_IMAGE_MAX_TOTAL_MS', 65000);
        const enableFallbackPrompt = (process.env.GEMINI_ENABLE_FALLBACK_PROMPT || '').trim() === '1';
        const generationStartedAt = Date.now();

        try {
            const fallbackPrompt = `Create a clean, high-contrast, print-ready automotive wrap texture for ${modelName}. Theme: ${prompt}. No text, logos, watermark, UI, or letters.`;
            const promptVariants = enableFallbackPrompt
                ? [textPrompt, fallbackPrompt].filter((v, i, arr) => arr.indexOf(v) === i)
                : [textPrompt];
            let lastFailure: string | null = null;
            let lastErrorCode: string | null = null;
            let lastFinishReasons: string[] = [];
            let lastFinishMessages: string[] = [];
            let lastPromptBlockReason: string | null = null;
            let lastResponseId: string | null = null;
            let lastModelVersion: string | null = null;

            for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
                const model = modelCandidates[modelIndex];
                const currentGeminiApiUrl = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;

                for (let promptIndex = 0; promptIndex < promptVariants.length; promptIndex += 1) {
                    if (Date.now() - generationStartedAt > maxTotalMs) {
                        return {
                            success: false,
                            error: `AI 生成超时（>${Math.round(maxTotalMs / 1000)}s），请重试`,
                            errorCode: 'timeout',
                            finalPrompt: textPrompt,
                            finishReasons: lastFinishReasons,
                            finishMessages: lastFinishMessages,
                            promptBlockReason: lastPromptBlockReason,
                            responseId: lastResponseId,
                            modelVersion: lastModelVersion
                        };
                    }
                    const promptToUse = promptVariants[promptIndex];
                    const isRetryAttempt = modelIndex > 0 || promptIndex > 0;
                    console.log(`[AI-GEN] [${VERSION}] Requesting Gemini Image: ${currentGeminiApiUrl}${isRetryAttempt ? ' (fallback attempt)' : ''}`);

                    const response = await fetchWithRetry(`${currentGeminiApiUrl}?key=${apiKey}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: buildParts(promptToUse) }],
                            generationConfig: {
                                // Follow Gemini API docs: modality enum values are uppercase in REST payload.
                                responseModalities: ['IMAGE'],
                                candidateCount: 1,
                                imageConfig: {
                                    aspectRatio: maskDimensions.aspectRatio,
                                    ...(imageSize ? { imageSize } : {})
                                }
                            },
                        }),
                        timeoutMs: imageTimeoutMs,
                        maxRetries: imageMaxRetries,
                        retryBaseMs,
                        retryMaxMs,
                        logPrefix: '[AI-GEN]'
                    } as RequestInit & { timeoutMs: number; maxRetries: number; retryBaseMs: number; retryMaxMs: number; logPrefix?: string });

                    if (!response.ok) {
                        const errorText = await response.text();
                        const parsedError = parseGeminiHttpError(response.status, errorText);
                        lastFailure = parsedError.error;
                        lastErrorCode = parsedError.errorCode;
                        lastFinishReasons = parsedError.finishReasons || [];
                        lastFinishMessages = parsedError.finishMessages || [];
                        lastPromptBlockReason = parsedError.promptBlockReason || null;
                        lastResponseId = parsedError.responseId || null;
                        lastModelVersion = parsedError.modelVersion || null;
                        console.warn(`[AI-GEN] [${VERSION}] Gemini HTTP error model=${model} status=${response.status} code=${parsedError.errorCode}`);
                        if (!parsedError.retryable) {
                            return {
                                success: false,
                                error: parsedError.error,
                                errorCode: parsedError.errorCode,
                                promptBlockReason: parsedError.promptBlockReason || null,
                                finishReasons: parsedError.finishReasons || [],
                                finishMessages: parsedError.finishMessages || [],
                                responseId: parsedError.responseId || null,
                                modelVersion: parsedError.modelVersion || null,
                                finalPrompt: promptToUse
                            };
                        }
                        continue;
                    }

                    const content = await response.json();
                    const parsed = parseGeminiImageResponse(content, promptToUse);
                    if (parsed.ok && parsed.result) {
                        console.log(`[AI-GEN] [${VERSION}] Gemini image success with model ${model}`);
                        return parsed.result;
                    }

                    lastFailure = parsed.error || 'No image found in response';
                    lastErrorCode = parsed.errorCode || 'no_image_payload';
                    lastFinishReasons = parsed.finishReasons || [];
                    lastFinishMessages = parsed.finishMessages || [];
                    lastPromptBlockReason = parsed.promptBlockReason || null;
                    lastResponseId = parsed.responseId || null;
                    lastModelVersion = parsed.modelVersion || null;
                    if (!parsed.retryable) {
                        return {
                            success: false,
                            error: lastFailure,
                            errorCode: parsed.errorCode || 'no_image_payload',
                            promptBlockReason: parsed.promptBlockReason || null,
                            finishReasons: parsed.finishReasons || [],
                            finishMessages: parsed.finishMessages || [],
                            responseId: parsed.responseId || null,
                            modelVersion: parsed.modelVersion || null,
                            finalPrompt: promptToUse
                        };
                    }
                }
            }

            if (lastErrorCode === 'no_image_payload' && noImageRetryRounds > 0) {
                for (let round = 0; round < noImageRetryRounds; round += 1) {
                    if (Date.now() - generationStartedAt > maxTotalMs) {
                        return {
                            success: false,
                            error: `AI 生成超时（>${Math.round(maxTotalMs / 1000)}s），请重试`,
                            errorCode: 'timeout',
                            finalPrompt: textPrompt,
                            finishReasons: lastFinishReasons,
                            finishMessages: lastFinishMessages,
                            promptBlockReason: lastPromptBlockReason,
                            responseId: lastResponseId,
                            modelVersion: lastModelVersion
                        };
                    }
                    await sleep(700 * (round + 1));
                    const rescuePrompt = `Create a clear automotive wrap texture for ${modelName}. Theme: ${prompt}. Return image only. Keep outside mask black. No text or logos.`;
                    console.warn(`[AI-GEN] [${VERSION}] No-image rescue round ${round + 1}/${noImageRetryRounds}`);
                    for (const model of modelCandidates) {
                        if (Date.now() - generationStartedAt > maxTotalMs) {
                            return {
                                success: false,
                                error: `AI 生成超时（>${Math.round(maxTotalMs / 1000)}s），请重试`,
                                errorCode: 'timeout',
                                finalPrompt: textPrompt,
                                finishReasons: lastFinishReasons,
                                finishMessages: lastFinishMessages,
                                promptBlockReason: lastPromptBlockReason,
                                responseId: lastResponseId,
                                modelVersion: lastModelVersion
                            };
                        }
                        const rescueUrl = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;
                        console.log(`[AI-GEN] [${VERSION}] Rescue attempt model=${model}`);
                        const rescueResponse = await fetchWithRetry(`${rescueUrl}?key=${apiKey}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            },
                            body: JSON.stringify({
                                contents: [{ role: 'user', parts: buildParts(rescuePrompt) }],
                                generationConfig: {
                                    responseModalities: ['IMAGE'],
                                    candidateCount: 1,
                                    imageConfig: {
                                        aspectRatio: maskDimensions.aspectRatio,
                                        ...(imageSize ? { imageSize } : {})
                                    }
                                },
                            }),
                            timeoutMs: imageTimeoutMs,
                            maxRetries: imageMaxRetries,
                            retryBaseMs,
                            retryMaxMs,
                            logPrefix: '[AI-GEN]'
                        } as RequestInit & { timeoutMs: number; maxRetries: number; retryBaseMs: number; retryMaxMs: number; logPrefix?: string });

                        if (!rescueResponse.ok) {
                            const errorText = await rescueResponse.text();
                            const parsedError = parseGeminiHttpError(rescueResponse.status, errorText);
                            lastFailure = parsedError.error;
                            lastErrorCode = parsedError.errorCode;
                            lastFinishReasons = parsedError.finishReasons || [];
                            lastFinishMessages = parsedError.finishMessages || [];
                            lastPromptBlockReason = parsedError.promptBlockReason || null;
                            lastResponseId = parsedError.responseId || null;
                            lastModelVersion = parsedError.modelVersion || null;
                            if (!parsedError.retryable) {
                                continue;
                            }
                            continue;
                        }

                        const rescueContent = await rescueResponse.json();
                        const rescueParsed = parseGeminiImageResponse(rescueContent, rescuePrompt);
                        if (rescueParsed.ok && rescueParsed.result) {
                            console.log(`[AI-GEN] [${VERSION}] Gemini image success in rescue mode with model ${model}`);
                            return rescueParsed.result;
                        }

                        lastFailure = rescueParsed.error || 'No image found in response';
                        lastErrorCode = rescueParsed.errorCode || 'no_image_payload';
                        lastFinishReasons = rescueParsed.finishReasons || [];
                        lastFinishMessages = rescueParsed.finishMessages || [];
                        lastPromptBlockReason = rescueParsed.promptBlockReason || null;
                        lastResponseId = rescueParsed.responseId || null;
                        lastModelVersion = rescueParsed.modelVersion || null;
                    }
                }
            }

            return {
                success: false,
                error: lastFailure || 'No image found in response',
                errorCode: lastErrorCode || 'no_image_payload',
                finishReasons: lastFinishReasons,
                finishMessages: lastFinishMessages,
                promptBlockReason: lastPromptBlockReason,
                responseId: lastResponseId,
                modelVersion: lastModelVersion,
                finalPrompt: textPrompt
            };

        } catch (error: any) {
            throw error;
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        if (error instanceof Error && (error as any).cause) {
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorCode: 'unknown_error',
            finalPrompt: textPrompt
        };
    }
}

/**
 * Load an image from URL and convert to base64
 */
export async function imageUrlToBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to fetch image:', url);
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return base64;
    } catch (error) {
        console.error('Error converting image to base64:', error);
        return null;
    }
}

/**
 * Validate image dimensions (should be 1024x768)
 */
export function validateImageDimensions(
    width: number,
    height: number
): { valid: boolean; message?: string } {
    const expectedWidth = 1024;
    const expectedHeight = 768;

    if (width === expectedWidth && height === expectedHeight) {
        return { valid: true };
    }

    return {
        valid: false,
        message: `Image dimensions ${width}x${height} do not match expected ${expectedWidth}x${expectedHeight}`
    };
}

/**
 * Utility to generate bilingual title and description using Gemini text model
 */
export async function generateBilingualMetadata(userPrompt: string, modelName: string): Promise<{
    name: string;
    name_en: string;
    description: string;
    description_en: string;
}> {
    const VERSION = "V1.1.1";
    try {
        const apiKey = (process.env.GEMINI_API_KEY || '').trim();
        if (!apiKey) throw new Error('GEMINI_API_KEY missing');

        // Note: Use configurable text model for compatibility with proxy/model availability
        const MODEL = (process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash').trim();
        if (!MODEL) throw new Error('GEMINI_TEXT_MODEL is empty');
        const apiBaseUrl = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').trim();
        const url = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

        const systemInstruction = `You are a professional automotive wrap titler. 
Based on the user's prompt (which could be in Chinese, English, or any other language), generate a creative title and a short description for the car wrap in BOTH Chinese and English. 
- If the prompt is in English, generate a high-quality Chinese equivalent.
- If the prompt is in Chinese, generate a high-quality English equivalent.
Return ONLY a JSON object with keys: name, name_en, description, description_en. 
Keep titles under 15 characters and descriptions under 50 characters.`;

        console.log(`[AI-GEN] Requesting Gemini Metadata: ${apiBaseUrl.replace(/https?:\/\//, '')}/...`);

        const textTimeoutMs = readEnvInt('GEMINI_TEXT_TIMEOUT_MS', 60000);
        const textMaxRetries = readEnvInt('GEMINI_TEXT_RETRIES', 1);
        const retryBaseMs = readEnvInt('GEMINI_RETRY_BASE_MS', 800);
        const retryMaxMs = readEnvInt('GEMINI_RETRY_MAX_MS', 5000);

        try {
            const response = await fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `User Prompt: ${userPrompt}\nModel: ${modelName}` }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: {
                        responseMimeType: "application/json",
                    }
                }),
                timeoutMs: textTimeoutMs,
                maxRetries: textMaxRetries,
                retryBaseMs,
                retryMaxMs,
                logPrefix: '[AI-GEN]'
            } as RequestInit & { timeoutMs: number; maxRetries: number; retryBaseMs: number; retryMaxMs: number; logPrefix?: string });

            if (!response.ok) throw new Error(`Metadata AI failed: ${response.status}`);

            const content = await response.json();
            const text = content.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('No text in metadata response');

            return JSON.parse(text);
        } catch (error: any) {
            throw error;
        }
    } catch (err) {
        console.error('Failed to generate bilingual metadata:', err);
        // Fallback
        const fallbackName = userPrompt.substring(0, 50);
        return {
            name: fallbackName,
            name_en: fallbackName,
            description: '',
            description_en: ''
        };
    }
}
