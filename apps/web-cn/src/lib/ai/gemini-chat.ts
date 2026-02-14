import { WECHAT_AI_SYSTEM_PROMPT } from './chat-prompt';
import dns from 'dns';

// 强制优先使用 IPv4, 防止容器 IPv6 路由缺失导致的秒级超时
if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

const GEMINI_API_URL_MODEL = (process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash').trim();

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
    // 使用 v1beta 支持 systemInstruction
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
        console.log(`[AI-CHAT] Requesting Gemini (${GEMINI_API_URL_MODEL}) through ${apiBaseUrl}`);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI-CHAT] Gemini API responded with ${response.status}: ${errorText}`);

            // 尝试备选模型，如果 gemini-2.5-flash 不存在
            if (response.status === 404 && GEMINI_API_URL_MODEL === 'gemini-2.5-flash') {
                console.log('[AI-CHAT] Falling back to gemini-1.5-flash...');
                const fallbackUrl = `${apiBaseUrl.replace(/\/$/, '')}/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
                const fallbackRes = await fetch(fallbackUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    },
                    body: JSON.stringify(payload)
                });
                if (fallbackRes.ok) {
                    const data = await fallbackRes.json();
                    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '抱歉，我没能理解您的意思。';
                }
            }

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
