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
    usage?: any; // Token usage info if available
    finalPrompt?: string; // The exact prompt sent to AI
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

        const MODEL = (process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview').trim();
        if (!MODEL) {
            throw new Error('GEMINI_IMAGE_MODEL is empty');
        }
        const apiBaseUrl = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').trim();
        const currentGeminiApiUrl = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${MODEL}:generateContent`;

        console.log(`[AI-GEN] [${VERSION}] Requesting Gemini Image: ${currentGeminiApiUrl}`);

        const parts: any[] = [];

        if (maskImageBase64) {
            const cleanMaskBase64 = maskImageBase64.includes('base64,')
                ? maskImageBase64.split('base64,')[1]
                : maskImageBase64;

            parts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: cleanMaskBase64
                }
            });
        }

        parts.push({ text: textPrompt });

        if (referenceImagesBase64 && referenceImagesBase64.length > 0) {
            referenceImagesBase64.forEach((base64: string) => {
                parts.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: base64
                    }
                });
            });
        }

        const imageTimeoutMs = readEnvInt('GEMINI_IMAGE_TIMEOUT_MS', 60000);
        const imageMaxRetries = readEnvInt('GEMINI_IMAGE_RETRIES', 2);
        const retryBaseMs = readEnvInt('GEMINI_RETRY_BASE_MS', 800);
        const retryMaxMs = readEnvInt('GEMINI_RETRY_MAX_MS', 5000);

        try {
            const response = await fetchWithRetry(`${currentGeminiApiUrl}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        responseModalities: ['Image'],
                        imageConfig: {
                            aspectRatio: maskDimensions.aspectRatio,
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
                throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
            }

            const content = await response.json();
            const usageMetadata = content.usageMetadata;

            if (content.candidates && content.candidates.length > 0) {
                const candidate = content.candidates[0];
                const part = candidate.content?.parts?.[0];

                if (part && part.inlineData) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    const base64 = part.inlineData.data;

                    return {
                        success: true,
                        imageBase64: base64,
                        dataUrl: `data:${mimeType};base64,${base64}`,
                        mimeType: mimeType,
                        usage: usageMetadata,
                        finalPrompt: textPrompt
                    };
                }

                if (candidate.finishReason === 'SAFETY') {
                    return { success: false, error: '生成失败：该提示词触发了安全过滤器 (SAFETY)' };
                }

                if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                    console.warn(`[AI-GEN] Task ${params.modelSlug} finished with reason: ${candidate.finishReason}`);
                }
            }

            const textPart = content.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text);
            if (textPart) {
                return {
                    success: false,
                    error: `Model returned text instead of image: ${textPart.text.substring(0, 200)}`
                };
            }

            return { success: false, error: 'No image found in response' };

        } catch (error: any) {
            throw error;
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        if (error instanceof Error && (error as any).cause) {
            console.error('[AI-DEBUG] Error Cause:', (error as any).cause);
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
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
