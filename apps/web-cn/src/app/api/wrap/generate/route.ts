/**
 * API Route: /api/wrap/generate
 * Handles AI wrap texture generation requests
 */

// Import proxy configuration first
import '@/lib/proxy-config';

import { NextRequest, NextResponse } from 'next/server';
import { generateWrapTexture, imageUrlToBase64, generateBilingualMetadata } from '@/lib/ai/gemini-image';
import { uploadToOSS } from '@/lib/oss';
import { getMaskUrl } from '@/lib/ai/mask-config';
import { logTaskStep } from '@/lib/ai/task-logger';
import { WRAP_CATEGORY } from '@/lib/constants/category';
import { ServiceType, getServiceCost } from '@/lib/constants/credits';
import { buildSlugBase, ensureUniqueSlug } from '@/lib/slug';
import { db, dbQuery } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

// Allow longer execution time for AI generation (Vercel Pro: 300s, Hobby: 60s max)
export const maxDuration = 300;

// Model slug to display name mapping
const MODEL_NAMES: Record<string, string> = {
    'cybertruck': 'Cybertruck',
    'model-3': 'Model 3',
    'model-3-2024-plus': 'Model 3 2024+',
    'model-y-pre-2025': 'Model Y',
    'model-y-2025-plus': 'Model Y 2025+',
};

const MAX_REFERENCE_IMAGES = 3;
const MAX_REFERENCE_IMAGE_BYTES = 1.5 * 1024 * 1024;

const allowedReferenceHosts = new Set(
    [
        process.env.CDN_DOMAIN,
        process.env.NEXT_PUBLIC_CDN_URL,
        'https://cdn.tewan.club'
    ]
        .filter(Boolean)
        .map(domain => {
            const normalized = domain!.replace(/\/+$/, '');
            try {
                return new URL(normalized).hostname;
            } catch {
                return normalized.replace(/^https?:\/\//, '');
            }
        })
);

function extractBase64Payload(input: string): string | null {
    if (!input) return null;
    const dataUrlMatch = input.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (dataUrlMatch) return dataUrlMatch[2];
    if (input.includes(',')) {
        const [, base64] = input.split(',', 2);
        return base64 || null;
    }
    return input;
}

function estimateBase64Size(base64: string): number {
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.floor((base64.length * 3) / 4) - padding;
}

function isAllowedReferenceUrl(input: string): boolean {
    if (!input) return false;
    if (input.startsWith('data:')) return true;
    if (!input.startsWith('http')) return true;
    try {
        const url = new URL(input);
        const hostAllowed = allowedReferenceHosts.has(url.hostname)
            || allowedReferenceHosts.has(`https://${url.hostname}`)
            || allowedReferenceHosts.has(`http://${url.hostname}`)
            || url.hostname.endsWith('.aliyuncs.com');
        if (!hostAllowed) return false;
        if (!url.pathname.startsWith('/wraps/reference/')) return false;
        return true;
    } catch {
        return false;
    }
}

async function deductCreditsForGeneration(params: {
    userId: string;
    prompt: string;
    amount: number;
    idempotencyKey?: string | null;
}) {
    const { userId, prompt, amount, idempotencyKey } = params;
    const client = await db().connect();
    try {
        await client.query('BEGIN');

        if (idempotencyKey) {
            const { rows: existing } = await client.query(
                `SELECT id FROM generation_tasks WHERE idempotency_key = $1 AND user_id = $2 LIMIT 1`,
                [idempotencyKey, userId]
            );
            if (existing[0]) {
                const { rows: balanceRows } = await client.query(
                    `SELECT balance FROM user_credits WHERE user_id = $1 LIMIT 1`,
                    [userId]
                );
                await client.query('COMMIT');
                return {
                    success: true,
                    taskId: existing[0].id as string,
                    remainingBalance: balanceRows[0]?.balance ?? 0,
                    errorMsg: 'Idempotent hit'
                };
            }
        }

        const { rows: creditRows } = await client.query(
            `SELECT balance FROM user_credits WHERE user_id = $1 FOR UPDATE`,
            [userId]
        );

        if (!creditRows[0] || creditRows[0].balance < amount) {
            await client.query('ROLLBACK');
            return { success: false, errorMsg: 'Insufficient credits or deduction failed' };
        }

        const newBalance = Number(creditRows[0].balance) - amount;
        await client.query(
            `UPDATE user_credits
             SET balance = $2,
                 total_spent = total_spent + $3,
                 updated_at = NOW()
             WHERE user_id = $1`,
            [userId, newBalance, amount]
        );

        const { rows: taskRows } = await client.query(
            `INSERT INTO generation_tasks (user_id, prompt, status, credits_spent, idempotency_key, created_at, updated_at)
             VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW())
             RETURNING id`,
            [userId, prompt, amount, idempotencyKey || null]
        );

        const taskId = taskRows[0].id as string;
        await client.query(
            `INSERT INTO credit_ledger (user_id, task_id, amount, type, description, created_at)
             VALUES ($1, $2, $3, 'generation', 'AI generation', NOW())`,
            [userId, taskId, -amount]
        );

        await client.query('COMMIT');
        return { success: true, taskId, remainingBalance: newBalance };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function refundTaskCredits(taskId: string, reason: string) {
    const client = await db().connect();
    try {
        await client.query('BEGIN');
        const { rows: taskRows } = await client.query(
            `SELECT id, user_id, credits_spent, status
             FROM generation_tasks
             WHERE id = $1
             FOR UPDATE`,
            [taskId]
        );
        if (!taskRows[0]) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Task not found' };
        }
        const task = taskRows[0];
        if (task.status === 'failed_refunded') {
            await client.query('COMMIT');
            return { success: true, alreadyRefunded: true };
        }

        const credits = Number(task.credits_spent || 0);
        const userId = task.user_id as string;

        const { rows: creditRows } = await client.query(
            `SELECT balance, total_spent FROM user_credits WHERE user_id = $1 FOR UPDATE`,
            [userId]
        );
        if (creditRows.length === 0) {
            await client.query(
                `INSERT INTO user_credits (user_id, balance, total_earned, total_spent, updated_at)
                 VALUES ($1, $2, $2, 0, NOW())`,
                [userId, credits]
            );
        } else {
            await client.query(
                `UPDATE user_credits
                 SET balance = balance + $2,
                     total_spent = GREATEST(total_spent - $2, 0),
                     updated_at = NOW()
                 WHERE user_id = $1`,
                [userId, credits]
            );
        }

        await client.query(
            `INSERT INTO credit_ledger (user_id, task_id, amount, type, description, created_at)
             VALUES ($1, $2, $3, 'refund', $4, NOW())`,
            [userId, taskId, credits, reason]
        );

        await client.query(
            `UPDATE generation_tasks
             SET status = 'failed_refunded',
                 steps = COALESCE(steps, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('step','refunded','ts', NOW(), 'reason', $2)),
                 error_message = COALESCE(error_message, $2),
                 updated_at = NOW()
             WHERE id = $1`,
            [taskId, reason]
        );

        await client.query('COMMIT');
        return { success: true };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function POST(request: NextRequest) {
    let taskId: string | undefined;
    const markTaskFailed = async (reason: string) => {
        if (!taskId) return;
        await dbQuery(
            `UPDATE generation_tasks
             SET status = 'failed',
                 error_message = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [taskId, reason]
        );
    };

    const requestId = crypto.randomUUID();
    console.log(`[AI-GEN] [${requestId}] Request received. Content-Length: ${request.headers.get('content-length')}`);

    try {
        // 1. 身份验证 (Authentication)
        const user = await getSessionUser();
        if (!user) {
            console.warn(`[AI-GEN] [${requestId}] Unauthorized`);
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log(`[AI-GEN] [${requestId}] User authenticated: ${user.id}`);

        let body;
        try {
            body = await request.json();
        } catch (e: any) {
            console.error(`[AI-GEN] [${requestId}] Failed to parse JSON body:`, e);
            return NextResponse.json({ success: false, error: 'Invalid JSON body. Payload might be too large.' }, { status: 400 });
        }

        const { modelSlug, prompt, referenceImages, idempotencyKey } = body;

        console.log(`[AI-GEN] [${requestId}] Payload parsed. Model: ${modelSlug}, Prompt len: ${prompt?.length}, Refs: ${referenceImages?.length}`);

        // 2. 参数校验
        if (!modelSlug || !prompt) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }
        if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > MAX_REFERENCE_IMAGES) {
            return NextResponse.json({ success: false, error: 'Too many reference images' }, { status: 413 });
        }
        if (referenceImages && Array.isArray(referenceImages)) {
            const hasInvalidRef = referenceImages.some((ref: any) => typeof ref !== 'string' || !isAllowedReferenceUrl(ref));
            if (hasInvalidRef) {
                return NextResponse.json({ success: false, error: 'Invalid reference image URL' }, { status: 400 });
            }
        }

        const currentModelSlug = modelSlug.toLowerCase();
        const modelName = MODEL_NAMES[currentModelSlug];
        if (!modelName) {
            return NextResponse.json({ success: false, error: 'Invalid model' }, { status: 400 });
        }

        // 3. 执行数据库原子扣费 RPC (带幂等支持)
        const requiredCredits = getServiceCost(ServiceType.AI_GENERATION);

        const deductResultRaw = await deductCreditsForGeneration({
            userId: user.id,
            prompt,
            amount: requiredCredits,
            idempotencyKey: idempotencyKey || null
        });

        if (!deductResultRaw?.success) {
            return NextResponse.json({
                success: false,
                error: deductResultRaw?.errorMsg || 'Insufficient credits or deduction failed'
            }, { status: 402 });
        }

        taskId = deductResultRaw.taskId;

        // 如果是幂等命中，且任务已经完成，直接返回结果 (理想情况下这里应该查询任务结果)
        if (deductResultRaw.errorMsg === 'Idempotent hit') {
            console.log(`[AI-GEN] ♻️ Idempotency hit: ${taskId}`);
            const { rows } = await dbQuery(
                `SELECT id, slug, texture_url, preview_url
                 FROM wraps
                 WHERE generation_task_id = $1 AND user_id = $2
                 LIMIT 1`,
                [taskId, user.id]
            );
            const existingWrap = rows[0];
            if (existingWrap?.texture_url) {
                return NextResponse.json({
                    success: true,
                    taskId,
                    wrapId: existingWrap.id,
                    image: {
                        dataUrl: existingWrap.preview_url || existingWrap.texture_url,
                        mimeType: 'image/png',
                        savedUrl: existingWrap.texture_url
                    },
                    remainingBalance: deductResultRaw?.remainingBalance ?? 0
                });
            }

            return NextResponse.json({
                success: true,
                taskId,
                status: 'pending',
                remainingBalance: deductResultRaw?.remainingBalance ?? 0
            }, { status: 202 });
        }

        console.log(`[AI-GEN] ✅ Task active: ${taskId}`);

        let maskImageBase64: string | null = null;
        try {
            console.log(`[AI-GEN] Fetching mask for ${currentModelSlug}...`);
            const maskUrl = getMaskUrl(currentModelSlug, request.nextUrl.origin);
            console.log(`[AI-GEN] Mask URL: ${maskUrl}`);
            const maskResponse = await fetch(maskUrl);

            if (maskResponse.ok) {
                const maskBuffer = Buffer.from(await maskResponse.arrayBuffer());
                console.log(`[AI-GEN] Mask fetched, size: ${maskBuffer.length} bytes`);

                // 已经使用了你上传到线上的“预旋转”Mask，因此不需要再做预处理旋转
                maskImageBase64 = maskBuffer.toString('base64');

                if (process.env.NODE_ENV === 'development') {
                    // 【调试部分】仅本地保存发送给 AI 的 Mask
                    try {
                        const debugBaseDir = join(process.cwd(), '../../dev-studio/test-previews');
                        const taskDebugDir = join(debugBaseDir, taskId as string);
                        console.log(`[AI-GEN] Saving debug mask to ${taskDebugDir}...`);
                        if (!existsSync(debugBaseDir)) await mkdir(debugBaseDir, { recursive: true });
                        if (!existsSync(taskDebugDir)) await mkdir(taskDebugDir, { recursive: true });

                        const inputMaskPath = join(taskDebugDir, 'input-mask.png');
                        await writeFile(inputMaskPath, maskBuffer);
                        console.log(`[AI-DEBUG] Input mask saved to: ${inputMaskPath}`);
                    } catch (debugErr) {
                        console.error('[AI-DEBUG] Failed to save input mask for debug:', debugErr);
                    }
                }
            } else {
                console.error(`[AI-GEN] Failed to fetch mask from: ${maskUrl}, Status: ${maskResponse.status}`);
            }
        } catch (error) {
            console.error('[AI-GEN] ❌ Mask processing failed:', error);
        }

        // 4. 处理并转存参考图 (Optional Reference Images)
        const savedReferenceUrls: string[] = [];
        if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
            console.log(`[AI-GEN] Processing ${referenceImages.length} reference images...`);
            for (let i = 0; i < referenceImages.length; i++) {
                try {
                    const base64Data = referenceImages[i];
                    if (!base64Data) continue;

                    const payload = extractBase64Payload(base64Data);
                    if (!payload) continue;
                    if (estimateBase64Size(payload) > MAX_REFERENCE_IMAGE_BYTES) {
                        return NextResponse.json({ success: false, error: 'Reference image too large' }, { status: 413 });
                    }
                    const buffer = Buffer.from(payload, 'base64');

                    const refFilename = `${taskId}-ref-${i}.png`;
                    const refUrl = await uploadToOSS(buffer, refFilename, 'wraps/reference');
                    savedReferenceUrls.push(refUrl);
                    console.log(`[AI-GEN] Reference image ${i} uploaded: ${refUrl}`);
                } catch (e) {
                    console.error(`[AI-GEN] Failed to upload reference image ${i}:`, e);
                }
            }
        }

        // 5. 调用 Gemini 生成纹理 (Call AI)
        console.log(`[AI-GEN] Preparing for Gemini generation...`);
        const referenceImagesBase64: string[] = [];
        if (referenceImages && Array.isArray(referenceImages)) {
            for (const refImage of referenceImages) {
                if (typeof refImage !== 'string') continue;
                const base64 = refImage.startsWith('http')
                    ? await imageUrlToBase64(refImage)
                    : extractBase64Payload(refImage);
                if (base64) referenceImagesBase64.push(base64);
            }
        }

        // 5. 并行准备：开始生图的同时，也开始准备元数据
        console.log(`[AI-GEN] Starting parallel tasks: Gemini image and bilingual metadata...`);

        const logStep = (step: string, status?: string, reason?: string) =>
            logTaskStep(taskId, step, status, reason);

        await logStep('ai_call_start', 'processing');
        await dbQuery(
            `UPDATE generation_tasks
             SET status = 'processing', updated_at = NOW()
             WHERE id = $1 AND user_id = $2`,
            [taskId, user.id]
        );

        // 同时启动两个 AI 任务
        const metadataPromise = generateBilingualMetadata(prompt, modelName);
        void metadataPromise.catch(err => {
            console.error('[AI-GEN] Failed to generate bilingual metadata:', err);
        });
        const imageGenerationPromise = generateWrapTexture({
            modelSlug,
            modelName,
            prompt,
            maskImageBase64: maskImageBase64 || undefined,
            referenceImagesBase64: referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined,
        });

        // 等待生图结果
        const result = await imageGenerationPromise;

        // 6. 处理结果
        if (!result.success) {
            // 失败：更新任务状态并自动退款
            console.error(`[AI-GEN] AI generation failed, triggering refund for task ${taskId}, user ${user.id}...`);
            await markTaskFailed(`AI API Error: ${result.error}`);
            if (taskId) await refundTaskCredits(taskId, `AI API Error: ${result.error}`);

            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

        // 记录步骤：AI 响应成功
        await logStep('ai_response_received');

        // 7. 成功：记录结果并返回
        if (!result.dataUrl) {
            return NextResponse.json({ success: false, error: 'AI generated image but no data returned' }, { status: 500 });
        }

        let savedUrl = result.dataUrl;
        let correctedDataUrl = result.dataUrl;

        try {
            if (!taskId) throw new Error('Task ID is missing');
            const filename = `wrap-${taskId.substring(0, 8)}-${Date.now()}.png`;

            const base64Data = result.dataUrl.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            // 记录步骤：准备上传 OSS
            await logStep('oss_upload_start');

            // 1. 直接上传到云端 OSS (不经过 Sharp 旋转)
            try {
                const rawUrl = await uploadToOSS(buffer, filename, 'wraps/ai-generated');

                // 2. 在 URL 后挂载云端旋转和缩放参数 (x-oss-process)
                // 核心逻辑：从 AI 视角(车头向下)转回 3D 视角
                if (currentModelSlug.includes('cybertruck')) {
                    // Cybertruck: 顺时针旋转 90 度 -> 车头向左 (1024x768)
                    savedUrl = `${rawUrl}?x-oss-process=image/rotate,90/resize,w_1024,h_768`;
                } else {
                    // Model 3/Y: 旋转 180 度 -> 车头向上 (1024x1024)
                    savedUrl = `${rawUrl}?x-oss-process=image/rotate,180/resize,w_1024,h_1024`;
                }
                correctedDataUrl = savedUrl; // 前端可以直接使用带参数的 URL

                // 记录步骤：OSS 上传成功
                await logStep('oss_upload_success');

            } catch (ossErr) {
                console.error(`[AI-GEN] OSS Upload failed for task ${taskId}, user ${user.id}:`, ossErr);
                await markTaskFailed('OSS upload failed');
                if (taskId) await refundTaskCredits(taskId, 'OSS upload failed');
                return NextResponse.json({ success: false, error: 'Storage upload failed' }, { status: 500 });
            }

        } catch (err) {
            console.error(`❌ [AI-GEN] Image processing error for task ${taskId}, user ${user.id}:`, err);
            await markTaskFailed('Image processing failed');
            if (taskId) await refundTaskCredits(taskId, 'Image processing failed');
            return NextResponse.json({ success: false, error: 'Image correction failed' }, { status: 500 });
        }

        // 记录步骤：准备保存至作品表
        await logStep('database_save_start');

        // 等待并获取元数据结果（元数据任务在后台可能已经跑完了）
        const metadata = await metadataPromise;

        // 插入到统一的作品表 wraps
        const slugBase = buildSlugBase({
            name: metadata.name,
            nameEn: metadata.name_en,
            prompt,
            modelSlug
        });
        const slug = await ensureUniqueSlug(slugBase);
        const { rows: wrapRows } = await dbQuery(
            `INSERT INTO wraps (
                user_id, name, name_en, description_en, prompt, model_slug,
                texture_url, preview_url, is_public, category, reference_images, generation_task_id, slug
            ) VALUES (
                $1,$2,$3,$4,$5,$6,
                $7,$8,$9,$10,$11,$12,$13
            ) RETURNING id, slug`,
            [
                user.id,
                metadata.name,
                metadata.name_en,
                metadata.description_en,
                prompt,
                modelSlug,
                savedUrl,
                savedUrl,
                false,
                WRAP_CATEGORY.AI_GENERATED,
                savedReferenceUrls,
                taskId,
                slug
            ]
        );

        const wrapId = wrapRows[0]?.id;
        if (!wrapId) {
            await logStep('database_save_failed', undefined, 'Failed to save result');
            return NextResponse.json({ success: false, error: 'Failed to save result' }, { status: 500 });
        }

        if (taskId && wrapId) {
            await dbQuery(
                `UPDATE generation_tasks
                 SET status = 'completed', wrap_id = $2, updated_at = NOW()
                 WHERE id = $1 AND user_id = $3`,
                [taskId, wrapId, user.id]
            );
        }

        // 记录步骤：作品保存成功
        await logStep('database_save_success');

        // 记录步骤：任务最终完成
        await logStep('completed', 'completed');

        return NextResponse.json({
            success: true,
            taskId,
            wrapId,
            image: {
                dataUrl: correctedDataUrl,
                mimeType: result.mimeType,
                savedUrl: savedUrl
            },
            remainingBalance: deductResultRaw?.remainingBalance ?? 0
        });

    } catch (error: any) {
        console.error('❌ [AI-GEN] Global API Error:', error);

        if (taskId) {
            await markTaskFailed(`Global API Error: ${error instanceof Error ? error.message : String(error)}`);
            // Try to log the failure to the DB so it shows in Admin Console
            try {
                // Try logging with user client first as it's already instantiated (hopefully)
                await logTaskStep(taskId, 'failed', 'failed', `Global Error: ${error instanceof Error ? error.message : String(error)}`);
            } catch (logErr) {
                console.error('[AI-GEN] Failed to log final error status:', logErr);
            }

            try {
                console.log(`[AI-GEN] Triggering emergency auto-refund for task ${taskId} due to global error...`);
                const refundRes = await refundTaskCredits(taskId, `Global API Error: ${error instanceof Error ? error.message : String(error)}`);
                console.log(`[AI-GEN] Emergency refund result:`, refundRes);
            } catch (innerErr) {
                console.error('[AI-GEN] Failed to refund task credits/create admin client in exit handler:', innerErr);
                // The task is already logged as failed above, so at least we have visibility.
            }
        }

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error'
        }, { status: 500 });
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
