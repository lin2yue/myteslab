import {
    buildWrapPrompt,
    getPromptVersionFromEnv,
    buildMaskHardConstraintSnippet,
} from './prompts';
import { getMaskDimensions } from './mask-config';
import dns from 'dns';
import sharp from 'sharp';

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
const REFERENCE_IMAGE_MAX_SIDE = readEnvInt('GEMINI_REFERENCE_MAX_SIDE', 1024);
const REFERENCE_IMAGE_JPEG_QUALITY = Math.max(40, Math.min(95, readEnvInt('GEMINI_REFERENCE_JPEG_QUALITY', 78)));
const REFERENCE_IMAGE_TARGET_BYTES = readEnvInt('GEMINI_REFERENCE_TARGET_BYTES', 900 * 1024);

interface GenerateWrapParams {
    modelSlug: string;
    modelName: string;
    prompt: string;
    maskImageUrl?: string;
    maskImageBase64?: string;
    referenceImageUrls?: string[];
    referenceImagesBase64?: string[];
}

type RequestPartsLayoutMode = 'mask_first' | 'legacy';

export type PromptRetryFailureSignal = {
    errorCode?: string;
    promptBlockReason?: string | null;
    finishReasons?: string[];
    finishMessages?: string[];
};

export type PromptOptimizationResult = {
    success: boolean;
    changed: boolean;
    optimizedPrompt: string;
    reason?: string;
    responseId?: string | null;
    modelVersion?: string | null;
    error?: string;
};

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
    requestPayload?: Record<string, unknown>;
    requestModel?: string | null;
    requestMode?: 'uri' | 'inline';
    requestApiUrl?: string | null;
    requestAttempt?: number;
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
const URL_FETCH_ERROR_KEYWORDS = [
    'unable to fetch',
    'failed to fetch',
    'could not fetch',
    'could not retrieve',
    'not accessible',
    'permission denied',
    'signed url',
    'url',
    'uri',
    'file_data',
    'file uri',
    'expired',
    '404',
    '403'
];

function inferMimeTypeFromUrl(url: string): string {
    const lower = url.toLowerCase();
    if (lower.includes('.png')) return 'image/png';
    if (lower.includes('.webp')) return 'image/webp';
    if (lower.includes('.gif')) return 'image/gif';
    if (lower.includes('.jpeg') || lower.includes('.jpg')) return 'image/jpeg';
    return 'image/jpeg';
}

function likelyUrlFetchFailure(errorOrMessage: string | null | undefined, finishMessages: string[] = []): boolean {
    const merged = [errorOrMessage || '', ...finishMessages]
        .join(' ')
        .toLowerCase();
    if (!merged) return false;
    return URL_FETCH_ERROR_KEYWORDS.some(keyword => merged.includes(keyword));
}

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

function resolveRequestPartsLayoutMode(): RequestPartsLayoutMode {
    const raw = (process.env.GEMINI_IMAGE_PARTS_LAYOUT || '').trim().toLowerCase();
    return raw === 'legacy' ? 'legacy' : 'mask_first';
}

function buildRequestTextWithInputContract(params: {
    prompt: string;
}): string {
    return params.prompt.trim();
}

function summarizeRequestPartKinds(parts: any[]): string {
    return parts.map((part) => {
        if (part?.fileData) return 'fileData';
        if (part?.inlineData) return 'inlineData';
        if (typeof part?.text === 'string') return 'text';
        return 'unknown';
    }).join(' > ');
}

function sanitizeGeminiRequestPayload(payload: any): Record<string, unknown> {
    const sanitizePart = (part: any): Record<string, unknown> => {
        if (!part || typeof part !== 'object') return {};

        if (part.fileData && typeof part.fileData === 'object') {
            return {
                fileData: {
                    mimeType: part.fileData.mimeType,
                    fileUri: part.fileData.fileUri
                }
            };
        }

        if (part.inlineData && typeof part.inlineData === 'object') {
            const rawData = typeof part.inlineData.data === 'string' ? part.inlineData.data : '';
            return {
                inlineData: {
                    mimeType: part.inlineData.mimeType,
                    data: `<base64_omitted:${rawData.length}_chars>`
                }
            };
        }

        if (typeof part.text === 'string') {
            return { text: part.text };
        }

        return { ...part };
    };

    const safePayload: Record<string, unknown> = {};

    if (Array.isArray(payload?.contents)) {
        safePayload.contents = payload.contents.map((content: any) => ({
            ...(typeof content?.role === 'string' ? { role: content.role } : {}),
            parts: Array.isArray(content?.parts) ? content.parts.map(sanitizePart) : []
        }));
    }

    if (payload?.systemInstruction && typeof payload.systemInstruction === 'object') {
        safePayload.systemInstruction = {
            parts: Array.isArray(payload.systemInstruction.parts)
                ? payload.systemInstruction.parts.map(sanitizePart)
                : []
        };
    }

    if (payload?.generationConfig && typeof payload.generationConfig === 'object') {
        safePayload.generationConfig = payload.generationConfig;
    }

    return safePayload;
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
    const VERSION = "V1.2.0";
    const {
        modelSlug, modelName, prompt,
        maskImageUrl, maskImageBase64,
        referenceImageUrls, referenceImagesBase64
    } = params;

    const maskDimensions = getMaskDimensions(modelSlug);
    let textPrompt = '';
    let lastRequestPayload: Record<string, unknown> | null = null;
    let lastRequestModel: string | null = null;
    let lastRequestMode: 'uri' | 'inline' | null = null;
    let lastRequestApiUrl: string | null = null;
    let lastRequestAttempt = 0;

    const withRequestDebug = (result: GenerateWrapResult): GenerateWrapResult => ({
        ...result,
        ...(lastRequestPayload ? { requestPayload: lastRequestPayload } : {}),
        ...(lastRequestModel ? { requestModel: lastRequestModel } : {}),
        ...(lastRequestMode ? { requestMode: lastRequestMode } : {}),
        ...(lastRequestApiUrl ? { requestApiUrl: lastRequestApiUrl } : {}),
        ...(lastRequestAttempt > 0 ? { requestAttempt: lastRequestAttempt } : {}),
    });

    try {
        const apiKey = (process.env.GEMINI_API_KEY || '').trim();
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not defined');
        }

        const promptVersion = getPromptVersionFromEnv();
        const hasReferenceInputs = Boolean(
            (referenceImageUrls || []).some((url) => typeof url === 'string' && url.trim())
            || (referenceImagesBase64 || []).some((image) => typeof image === 'string' && image.trim())
        );
        textPrompt = buildWrapPrompt({
            userPrompt: prompt,
            modelName,
            version: promptVersion,
            outputSize: { width: maskDimensions.width, height: maskDimensions.height },
            hasReferences: hasReferenceInputs
        });
        const maskHardConstraintSnippet = buildMaskHardConstraintSnippet({
            outputSize: { width: maskDimensions.width, height: maskDimensions.height }
        });
        const requestPartsLayoutMode = resolveRequestPartsLayoutMode();

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
        const normalizedReferenceImageUrls = Array.from(
            new Set(
                (referenceImageUrls || [])
                    .map((url) => (typeof url === 'string' ? url.trim() : ''))
                    .filter(Boolean)
            )
        );
        const hasUriInputs = Boolean(maskImageUrl) || normalizedReferenceImageUrls.length > 0;
        const hasInlineInputs = Boolean(maskImageBase64) || (referenceImagesBase64?.length || 0) > 0;
        let inlineReferencesFromUrlsCache: string[] | null = null;

        const getInlineReferencesFromUrls = async (): Promise<string[]> => {
            if (inlineReferencesFromUrlsCache) return inlineReferencesFromUrlsCache;
            const converted: string[] = [];
            for (const url of normalizedReferenceImageUrls) {
                const base64 = await imageUrlToBase64(url);
                if (base64) converted.push(base64);
            }
            inlineReferencesFromUrlsCache = converted;
            return converted;
        };

        const buildParts = async (promptValue: string, mode: 'uri' | 'inline') => {
            const maskParts: any[] = [];
            const referenceParts: any[] = [];

            // 1. Prepare Mask Part (Always prefer URL for speed if it's likely to work, or Base64 for safety)
            // But actually, for Mask, if we already have it in Base64 (from Backend fetch), 
            // the added payload is small enough that we can just use inlineData if we want maximum reliability,
            // OR use fileData for URL if we want zero payload. Let's stick to the URL-first hybrid approach.
            if (mode === 'uri' && maskImageUrl) {
                maskParts.push({ fileData: { mimeType: 'image/png', fileUri: maskImageUrl } });
            } else if (maskImageBase64) {
                const cleanMaskBase64 = maskImageBase64.includes('base64,')
                    ? maskImageBase64.split('base64,')[1]
                    : maskImageBase64;
                maskParts.push({ inlineData: { mimeType: 'image/png', data: cleanMaskBase64 } });
            }

            // 2. Prepare Reference Parts
            if (mode === 'uri' && normalizedReferenceImageUrls.length > 0) {
                normalizedReferenceImageUrls.forEach((url) => {
                    referenceParts.push({ fileData: { mimeType: inferMimeTypeFromUrl(url), fileUri: url } });
                });
            }

            const inlineRefs: string[] = [];
            if (referenceImagesBase64 && referenceImagesBase64.length > 0) {
                inlineRefs.push(...referenceImagesBase64);
            }
            if (mode === 'inline' && normalizedReferenceImageUrls.length > 0) {
                inlineRefs.push(...await getInlineReferencesFromUrls());
            }

            if (inlineRefs.length > 0) {
                inlineRefs.forEach((base64) => {
                    referenceParts.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64
                        }
                    });
                });
            }

            if (requestPartsLayoutMode === 'legacy') {
                return [
                    { text: promptValue },
                    ...maskParts,
                    ...referenceParts
                ];
            }

            const contractPrompt = buildRequestTextWithInputContract({
                prompt: promptValue
            });

            return [
                ...maskParts,
                { text: contractPrompt },
                ...referenceParts
            ];
        };
        const buildRequestPayload = async (promptValue: string, mode: 'uri' | 'inline') => {
            const payload: any = {
                contents: [{ role: 'user', parts: await buildParts(promptValue, mode) }],
                generationConfig: {
                    // Follow Gemini API docs: modality enum values are uppercase in REST payload.
                    responseModalities: ['IMAGE'],
                    candidateCount: 1,
                    imageConfig: {
                        aspectRatio: maskDimensions.aspectRatio,
                        ...(imageSize ? { imageSize } : {})
                    }
                },
            };

            return payload;
        };
        const buildRetryPrompt = (mode: 'fallback' | 'rescue') => {
            const modeHint = mode === 'rescue'
                ? 'RESCUE MODE: model did not return a valid image. Keep constraints strict and simplify visual complexity.'
                : 'FALLBACK MODE: keep theme intent while prioritizing boundary compliance and print-ready output.';

            return [
                `TASK: Create a print-ready automotive wrap texture for ${modelName}.`,
                modeHint,
                maskHardConstraintSnippet,
                `Theme Request: "${prompt}"`,
                'No text, logos, watermark, UI, or letters.'
            ].join('\n\n');
        };

        const imageTimeoutMs = readEnvInt('GEMINI_IMAGE_TIMEOUT_MS', 60000);
        const imageMaxRetries = readEnvInt('GEMINI_IMAGE_RETRIES', 2);
        const retryBaseMs = readEnvInt('GEMINI_RETRY_BASE_MS', 800);
        const retryMaxMs = readEnvInt('GEMINI_RETRY_MAX_MS', 5000);
        const imageSize = (process.env.GEMINI_IMAGE_SIZE || '').trim();
        const logRequestParts = (process.env.GEMINI_LOG_REQUEST_PARTS || '').trim() === '1';
        const noImageRetryRounds = Math.min(readEnvInt('GEMINI_NO_IMAGE_RETRY_ROUNDS', 0), 3);
        const maxTotalMs = readEnvInt('GEMINI_IMAGE_MAX_TOTAL_MS', 65000);
        const enableFallbackPrompt = (process.env.GEMINI_ENABLE_FALLBACK_PROMPT || '').trim() === '1';
        const generationStartedAt = Date.now();

        try {
            const fallbackPrompt = buildRetryPrompt('fallback');
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
                        return withRequestDebug({
                            success: false,
                            error: `AI 生成超时（>${Math.round(maxTotalMs / 1000)}s），请重试`,
                            errorCode: 'timeout',
                            finalPrompt: textPrompt,
                            finishReasons: lastFinishReasons,
                            finishMessages: lastFinishMessages,
                            promptBlockReason: lastPromptBlockReason,
                            responseId: lastResponseId,
                            modelVersion: lastModelVersion
                        });
                    }
                    const promptToUse = promptVariants[promptIndex];
                    const isRetryAttempt = modelIndex > 0 || promptIndex > 0;
                    console.log(`[AI-GEN] [${VERSION}] Requesting Gemini Image: ${currentGeminiApiUrl}${isRetryAttempt ? ' (fallback attempt)' : ''}`);
                    let mode: 'uri' | 'inline' = hasUriInputs ? 'uri' : 'inline';
                    let triedInlineFallback = false;

                    while (true) {
                        const payload = await buildRequestPayload(promptToUse, mode);
                        lastRequestAttempt += 1;
                        lastRequestPayload = sanitizeGeminiRequestPayload(payload);
                        lastRequestModel = model;
                        lastRequestMode = mode;
                        lastRequestApiUrl = currentGeminiApiUrl;
                        if (logRequestParts) {
                            const parts = payload?.contents?.[0]?.parts || [];
                            console.log(`[AI-GEN] [${VERSION}] request layout mode=${requestPartsLayoutMode}, inputMode=${mode}, parts=${summarizeRequestPartKinds(parts)}`);
                        }
                        const response = await fetchWithRetry(`${currentGeminiApiUrl}?key=${apiKey}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            },
                            body: JSON.stringify(payload),
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

                            const shouldFallbackInline = mode === 'uri'
                                && !triedInlineFallback
                                && hasInlineInputs
                                && likelyUrlFetchFailure(parsedError.error, parsedError.finishMessages || []);
                            if (shouldFallbackInline) {
                                triedInlineFallback = true;
                                mode = 'inline';
                                console.warn(`[AI-GEN] [${VERSION}] file_uri fetch failed, retrying with inline fallback.`);
                                continue;
                            }

                            if (!parsedError.retryable) {
                                return withRequestDebug({
                                    success: false,
                                    error: parsedError.error,
                                    errorCode: parsedError.errorCode,
                                    promptBlockReason: parsedError.promptBlockReason || null,
                                    finishReasons: parsedError.finishReasons || [],
                                    finishMessages: parsedError.finishMessages || [],
                                    responseId: parsedError.responseId || null,
                                    modelVersion: parsedError.modelVersion || null,
                                    finalPrompt: promptToUse
                                });
                            }
                            break;
                        }

                        const content = await response.json();
                        const parsed = parseGeminiImageResponse(content, promptToUse);
                        if (parsed.ok && parsed.result) {
                            console.log(`[AI-GEN] [${VERSION}] Gemini image success with model ${model}`);
                            return withRequestDebug(parsed.result);
                        }

                        lastFailure = parsed.error || 'No image found in response';
                        lastErrorCode = parsed.errorCode || 'no_image_payload';
                        lastFinishReasons = parsed.finishReasons || [];
                        lastFinishMessages = parsed.finishMessages || [];
                        lastPromptBlockReason = parsed.promptBlockReason || null;
                        lastResponseId = parsed.responseId || null;
                        lastModelVersion = parsed.modelVersion || null;

                        const shouldFallbackInline = mode === 'uri'
                            && !triedInlineFallback
                            && hasInlineInputs
                            && likelyUrlFetchFailure(parsed.error, parsed.finishMessages || []);
                        if (shouldFallbackInline) {
                            triedInlineFallback = true;
                            mode = 'inline';
                            console.warn(`[AI-GEN] [${VERSION}] file_uri response indicates fetch failure, retrying with inline fallback.`);
                            continue;
                        }

                        if (!parsed.retryable) {
                            return withRequestDebug({
                                success: false,
                                error: lastFailure,
                                errorCode: parsed.errorCode || 'no_image_payload',
                                promptBlockReason: parsed.promptBlockReason || null,
                                finishReasons: parsed.finishReasons || [],
                                finishMessages: parsed.finishMessages || [],
                                responseId: parsed.responseId || null,
                                modelVersion: parsed.modelVersion || null,
                                finalPrompt: promptToUse
                            });
                        }
                        break;
                    }
                }
            }

            if (lastErrorCode === 'no_image_payload' && noImageRetryRounds > 0) {
                for (let round = 0; round < noImageRetryRounds; round += 1) {
                    if (Date.now() - generationStartedAt > maxTotalMs) {
                        return withRequestDebug({
                            success: false,
                            error: `AI 生成超时（>${Math.round(maxTotalMs / 1000)}s），请重试`,
                            errorCode: 'timeout',
                            finalPrompt: textPrompt,
                            finishReasons: lastFinishReasons,
                            finishMessages: lastFinishMessages,
                            promptBlockReason: lastPromptBlockReason,
                            responseId: lastResponseId,
                            modelVersion: lastModelVersion
                        });
                    }
                    await sleep(700 * (round + 1));
                    const rescuePrompt = buildRetryPrompt('rescue');
                    console.warn(`[AI-GEN] [${VERSION}] No-image rescue round ${round + 1}/${noImageRetryRounds}`);
                    for (const model of modelCandidates) {
                        if (Date.now() - generationStartedAt > maxTotalMs) {
                            return withRequestDebug({
                                success: false,
                                error: `AI 生成超时（>${Math.round(maxTotalMs / 1000)}s），请重试`,
                                errorCode: 'timeout',
                                finalPrompt: textPrompt,
                                finishReasons: lastFinishReasons,
                                finishMessages: lastFinishMessages,
                                promptBlockReason: lastPromptBlockReason,
                                responseId: lastResponseId,
                                modelVersion: lastModelVersion
                            });
                        }
                        const rescueUrl = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;
                        console.log(`[AI-GEN] [${VERSION}] Rescue attempt model=${model}`);
                        const rescuePayload = await buildRequestPayload(rescuePrompt, hasUriInputs ? 'uri' : 'inline');
                        lastRequestAttempt += 1;
                        lastRequestPayload = sanitizeGeminiRequestPayload(rescuePayload);
                        lastRequestModel = model;
                        lastRequestMode = hasUriInputs ? 'uri' : 'inline';
                        lastRequestApiUrl = rescueUrl;
                        const rescueResponse = await fetchWithRetry(`${rescueUrl}?key=${apiKey}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            },
                            body: JSON.stringify(rescuePayload),
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
                            return withRequestDebug(rescueParsed.result);
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

            return withRequestDebug({
                success: false,
                error: lastFailure || 'No image found in response',
                errorCode: lastErrorCode || 'no_image_payload',
                finishReasons: lastFinishReasons,
                finishMessages: lastFinishMessages,
                promptBlockReason: lastPromptBlockReason,
                responseId: lastResponseId,
                modelVersion: lastModelVersion,
                finalPrompt: textPrompt
            });

        } catch (error: any) {
            throw error;
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        if (error instanceof Error && (error as any).cause) {
        }
        return withRequestDebug({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorCode: 'unknown_error',
            finalPrompt: textPrompt
        });
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
        const rawBuffer = Buffer.from(arrayBuffer);

        try {
            const encodeJpeg = async (quality: number) => {
                return sharp(rawBuffer)
                    .rotate()
                    .resize(REFERENCE_IMAGE_MAX_SIDE, REFERENCE_IMAGE_MAX_SIDE, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({
                        quality,
                        mozjpeg: true,
                        progressive: true
                    })
                    .toBuffer();
            };

            let optimizedBuffer = await encodeJpeg(REFERENCE_IMAGE_JPEG_QUALITY);

            if (optimizedBuffer.length > REFERENCE_IMAGE_TARGET_BYTES) {
                const lowerQuality = Math.max(40, Math.floor(REFERENCE_IMAGE_JPEG_QUALITY * 0.72));
                const secondPass = await encodeJpeg(lowerQuality);
                if (secondPass.length < optimizedBuffer.length) {
                    optimizedBuffer = secondPass;
                }
            }

            return optimizedBuffer.toString('base64');
        } catch (compressionError) {
            console.warn('[AI-GEN] Reference image compression failed, fallback to raw buffer:', compressionError);
            return rawBuffer.toString('base64');
        }
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

function parseJsonObjectFromText(raw: string): any | null {
    const trimmed = (raw || '').trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            const slice = trimmed.slice(start, end + 1);
            try {
                return JSON.parse(slice);
            } catch {
                return null;
            }
        }
        return null;
    }
}

/**
 * Only used after a failed image attempt to do a minimal prompt rewrite.
 * Keep user intent, avoid aggressive changes.
 */
export async function optimizePromptForPolicyRetry(params: {
    userPrompt: string;
    modelName: string;
    failureSignal?: PromptRetryFailureSignal;
}): Promise<PromptOptimizationResult> {
    const originalPrompt = (params.userPrompt || '').trim();
    if (!originalPrompt) {
        return {
            success: false,
            changed: false,
            optimizedPrompt: originalPrompt,
            error: 'Empty prompt'
        };
    }

    try {
        const apiKey = (process.env.GEMINI_API_KEY || '').trim();
        if (!apiKey) throw new Error('GEMINI_API_KEY missing');

        const model = (process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash').trim();
        if (!model) throw new Error('GEMINI_TEXT_MODEL is empty');

        const apiBaseUrl = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').trim();
        const url = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const timeoutMs = readEnvInt('GEMINI_PROMPT_OPTIMIZE_TIMEOUT_MS', 20000);
        const maxRetries = readEnvInt('GEMINI_PROMPT_OPTIMIZE_RETRIES', 1);
        const retryBaseMs = readEnvInt('GEMINI_RETRY_BASE_MS', 800);
        const retryMaxMs = readEnvInt('GEMINI_RETRY_MAX_MS', 5000);

        const signal = params.failureSignal || {};
        const signalText = JSON.stringify({
            errorCode: signal.errorCode || '',
            promptBlockReason: signal.promptBlockReason || '',
            finishReasons: signal.finishReasons || [],
            finishMessages: signal.finishMessages || []
        });

        const systemInstruction = `You optimize a failed automotive wrap prompt with MINIMAL edits.
Rules:
1) Preserve user intent, style, colors and mood as much as possible.
2) If explicit copyrighted character names, trademarks, logos, or franchise titles appear, replace them with generic style descriptions.
3) Do not add new themes unrelated to the original prompt.
4) Keep final prompt within 120 Chinese characters or 220 English characters.
Return JSON only with keys: optimized_prompt, changed, reason.`;

        const userInput = `Model: ${params.modelName}
Original prompt: ${originalPrompt}
Last failure signal: ${signalText}`;

        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: userInput }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                    responseMimeType: 'application/json'
                }
            }),
            timeoutMs,
            maxRetries,
            retryBaseMs,
            retryMaxMs,
            logPrefix: '[AI-GEN]'
        } as RequestInit & { timeoutMs: number; maxRetries: number; retryBaseMs: number; retryMaxMs: number; logPrefix?: string });

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Prompt optimization failed: HTTP ${response.status}${body ? ` ${body.slice(0, 200)}` : ''}`);
        }

        const payload = await response.json();
        const responseId = typeof payload?.responseId === 'string' ? payload.responseId : null;
        const modelVersion = typeof payload?.modelVersion === 'string' ? payload.modelVersion : null;
        const rawText = extractTextPart(payload) || '';
        const parsed = parseJsonObjectFromText(rawText);

        const optimizedPromptRaw = typeof parsed?.optimized_prompt === 'string'
            ? parsed.optimized_prompt.trim()
            : '';
        const reason = typeof parsed?.reason === 'string' ? parsed.reason.trim() : '';

        let optimizedPrompt = optimizedPromptRaw || originalPrompt;
        optimizedPrompt = optimizedPrompt.replace(/\s+/g, ' ').trim();
        if (optimizedPrompt.length > 400) {
            optimizedPrompt = optimizedPrompt.slice(0, 400).trim();
        }

        const changedByContent = optimizedPrompt !== originalPrompt;
        const changed = typeof parsed?.changed === 'boolean' ? parsed.changed : changedByContent;

        return {
            success: true,
            changed,
            optimizedPrompt,
            reason,
            responseId,
            modelVersion
        };
    } catch (error: any) {
        return {
            success: false,
            changed: false,
            optimizedPrompt: originalPrompt,
            error: error instanceof Error ? error.message : String(error)
        };
    }
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
