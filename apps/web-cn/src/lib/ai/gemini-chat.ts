import { WECHAT_AI_SYSTEM_PROMPT } from './chat-prompt';

const GEMINI_API_URL_MODEL = 'gemini-1.5-flash';

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export async function generateAIChatReply(userMessage: string): Promise<string> {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
        console.error('[AI-CHAT] GEMINI_API_KEY is not defined');
        return '抱歉，系统暂时无法回复。';
    }

    const apiBaseUrl = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').trim();
    const apiUrl = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/${GEMINI_API_URL_MODEL}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [
            {
                role: 'user',
                parts: [{ text: userMessage }]
            }
        ],
        systemInstruction: {
            parts: [{ text: WECHAT_AI_SYSTEM_PROMPT }]
        },
        generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
        }
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI-CHAT] Gemini API responded with ${response.status}: ${errorText}`);
            return '抱歉，我现在有点忙，请稍后再试。';
        }

        const data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!replyText) {
            console.warn('[AI-CHAT] Gemini returned empty response', JSON.stringify(data));
            return '抱歉，我没能理解您的意思。';
        }

        return replyText.trim();
    } catch (error) {
        console.error('[AI-CHAT] Error calling Gemini API:', error);
        return '抱歉，连接 AI 服务时出现问题。';
    }
}
