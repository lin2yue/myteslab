/**
 * Gemini Image Generation API wrapper for wrap texture generation
 * Uses Gemini 3 Pro Image Preview with Image Editing mode
 */

import { buildWrapPrompt, WRAP_GENERATION_SYSTEM_PROMPT } from './prompts';
import { getMaskDimensions } from './mask-config';

/**
 * Build editing prompt for Image Editing mode
 * Uses professional UV layout and inpainting terminology for better mask adherence
 */
function buildEditingPrompt(userPrompt: string, modelName: string): string {
    // Detect if user wants a pattern/texture vs themed design
    const isPattern = /pattern|texture|camo|carbon|geometric|stripe|gradient|wave|abstract/i.test(userPrompt);

    return `ROLE: Professional automotive wrap designer
TASK: Inpaint design onto UV layout template for ${modelName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UV LAYOUT STRUCTURE (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is a UV-unwrapped car panel template:
• WHITE regions = Active Canvas (Hood, Doors, Fenders, Bumpers)
• BLACK regions = Negative Space / Absolute Void

ABSOLUTE BOUNDARY RULES:
1. BLACK = STRICT BARRIER - Treat as physical walls
2. Paint ONLY inside WHITE areas
3. NO bleeding, gradients, shadows, or artifacts into black
4. Edges must be CRISP and PIXEL-PERFECT aligned to mask

ROOF CENTER (BLACK AREA) - CRITICAL:
- This is the car's glass roof/windshield
- ABSOLUTE VOID - treat as a physical hole in the canvas
- NEVER extend design into this black center region
- Even gradients or shadows must NOT touch this area

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${isPattern
            ? `PATTERN/TEXTURE MODE:
• Create seamless repeating design across white panels
• Maintain consistent scale across UV islands
• Ensure pattern aligns logically at panel boundaries
• Roof center (black) = VOID, no pattern there`
            : `LIVERY/GRAPHIC MODE:
• Place hero elements on large white islands
• Use secondary elements to create flow between panels
• Ensure design flows logically across all panels
• NEVER place content in roof center (black area) - it's a void`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERENCE IMAGES (IF PROVIDED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If the user has provided reference images:
1. ANALYZE: Identify key visual elements (color palette, artistic style, motifs, lighting, textures).
2. INTEGRATE: Synthesize these elements with the user's text prompt.
3. PRIORITY: The reference images should guide the AESTHETIC and STYLE.
4. DO NOT COPY: Create an original design that feels inspired by the references, not a simple copy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Bold, high-contrast colors (suitable for vehicle wraps)
• Sharp edges (NO blur, NO soft gradients at boundaries)
• Professional automotive finish
• Large readable shapes (avoid excessive micro-detail)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPAINTING TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fill the white areas with: ${userPrompt}

FINAL CHECK:
✓ All content inside white areas?
✓ Roof center (black) completely untouched?
✓ Edges crisp and aligned to mask?
✓ Design flows logically across panels?

FAILURE = Any content in black roof area`;
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
    const { modelSlug, modelName, prompt, maskImageBase64, referenceImagesBase64 } = params;

    const maskDimensions = getMaskDimensions(modelSlug);
    let textPrompt = '';

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not defined');
        }

        textPrompt = maskImageBase64
            ? buildEditingPrompt(prompt, modelName)
            : buildWrapPrompt(modelName, prompt);

        const parts: any[] = [
            { text: textPrompt }
        ];

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

        const MODEL = 'gemini-3-pro-image-preview';
        const apiBaseUrl = process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com';
        const currentGeminiApiUrl = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${MODEL}:generateContent`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

        try {
            const response = await fetch(`${currentGeminiApiUrl}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
            }

            const content = await response.json();
            const usageMetadata = content.usageMetadata;

            if (content.candidates && content.candidates.length > 0) {
                const part = content.candidates[0].content.parts[0];
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
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('AI 生成超时 (超过 45s)');
            }
            throw error;
        }

    } catch (error) {
        console.error('Error calling Gemini API:', error);
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
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY missing');

        // Note: Using flash-latest for fast and cheap text generation
        const MODEL = 'gemini-flash-latest';
        const apiBaseUrl = process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com';
        const url = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

        const systemInstruction = `You are a professional automotive wrap titler. 
Based on the user's prompt (which could be in Chinese, English, or any other language), generate a creative title and a short description for the car wrap in BOTH Chinese and English. 
- If the prompt is in English, generate a high-quality Chinese equivalent.
- If the prompt is in Chinese, generate a high-quality English equivalent.
Return ONLY a JSON object with keys: name, name_en, description, description_en. 
Keep titles under 15 characters and descriptions under 50 characters.`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `User Prompt: ${userPrompt}\nModel: ${modelName}` }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                    responseMimeType: "application/json",
                }
            })
        });

        if (!response.ok) throw new Error(`Metadata AI failed: ${response.status}`);

        const content = await response.json();
        const text = content.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('No text in metadata response');

        return JSON.parse(text);
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
