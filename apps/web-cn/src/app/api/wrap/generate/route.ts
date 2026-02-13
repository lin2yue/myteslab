/**
 * API Route: /api/wrap/generate
 * Handles AI wrap texture generation requests
 */

// Import proxy configuration first
import '@/lib/proxy-config';

import { NextRequest, NextResponse } from 'next/server';
import { generateWrapTexture, optimizePromptForPolicyRetry, type GenerateWrapResult } from '@/lib/ai/gemini-image';
import { uploadToOSS } from '@/lib/oss';
import { getGeminiFileUri } from '@/lib/ai/gemini-files';
import { getMaskUrl, getMaskDimensions, MASK_DIMENSIONS } from '@/lib/ai/mask-config';
import { logTaskStep } from '@/lib/ai/task-logger';
import { WRAP_CATEGORY } from '@/lib/constants/category';
import { ServiceType, getServiceCost } from '@/lib/constants/credits';
import { buildSlugBase, ensureUniqueSlug } from '@/lib/slug';
import { db, dbQuery } from '@/lib/db';
import { getModelBySlug } from '@/config/models';
import { getSessionUser } from '@/lib/auth/session';
import crypto from 'crypto';

// Allow longer execution time for AI generation (Vercel Pro: 300s, Hobby: 60s max)
export const maxDuration = 300;

const MAX_REFERENCE_IMAGES = 3;
const MAX_REFERENCE_IMAGE_BYTES = 1.5 * 1024 * 1024;
const DEFAULT_FREE_CREDITS = Number(process.env.DEFAULT_FREE_CREDITS ?? 30);
const PER_USER_WINDOW_MS = Number(process.env.WRAP_GEN_RATE_WINDOW_MS ?? 60 * 1000);
const PER_USER_MAX_REQUESTS = Number(process.env.WRAP_GEN_RATE_MAX_REQUESTS ?? 6);
const PER_IP_WINDOW_MS = Number(process.env.WRAP_GEN_IP_RATE_WINDOW_MS ?? 60 * 1000);
const PER_IP_MAX_REQUESTS = Number(process.env.WRAP_GEN_IP_RATE_MAX_REQUESTS ?? 20);
const MAX_INFLIGHT_TASKS_PER_USER = Number(process.env.WRAP_GEN_MAX_INFLIGHT_TASKS ?? 2);
const ENABLE_PROMPT_OPTIMIZE_RETRY = (process.env.WRAP_GEN_ENABLE_PROMPT_OPTIMIZE_RETRY ?? '1').trim() !== '0';
const ENABLE_SUBMIT_ONLY = (process.env.WRAP_GEN_V2_SUBMIT ?? '0').trim() === '1';
const ENABLE_WORKER = (process.env.WRAP_GEN_V2_WORKER ?? '1').trim() !== '0';
const ENABLE_SUBMIT_WORKER_PATH = ENABLE_SUBMIT_ONLY && ENABLE_WORKER;
const RETRY_AFTER_SECONDS = Number(process.env.WRAP_TASK_RETRY_AFTER_SECONDS ?? 5);

const userRateMap = new Map<string, { count: number; windowStart: number }>();
const ipRateMap = new Map<string, { count: number; windowStart: number }>();

const allowedReferenceExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);

function normalizeHost(input: string): string {
    const normalized = input.trim().replace(/\/+$/, '');
    if (!normalized) return '';
    try {
        return new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`).hostname.toLowerCase();
    } catch {
        return normalized.replace(/^https?:\/\//, '').toLowerCase();
    }
}

const allowedReferenceHosts = new Set(
    [
        process.env.CDN_DOMAIN || '',
        process.env.NEXT_PUBLIC_CDN_URL || '',
        process.env.WRAP_REFERENCE_ALLOWED_HOSTS || '',
        'cdn.tewan.club'
    ]
        .flatMap(value => value.split(','))
        .map(value => normalizeHost(value))
        .filter(Boolean)
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

function takeRateQuota(
    map: Map<string, { count: number; windowStart: number }>,
    key: string,
    windowMs: number,
    maxRequests: number
): boolean {
    if (!key) return true;
    const now = Date.now();
    const state = map.get(key);
    if (!state || now - state.windowStart > windowMs) {
        map.set(key, { count: 1, windowStart: now });
        return true;
    }
    if (state.count >= maxRequests) {
        return false;
    }
    state.count += 1;
    map.set(key, state);
    return true;
}

function jsonAccepted(body: unknown) {
    return NextResponse.json(body, {
        status: 202,
        headers: {
            'Retry-After': String(RETRY_AFTER_SECONDS),
        }
    });
}

function buildLocalWrapMetadata(prompt: string, modelName: string) {
    const normalizedPrompt = prompt.replace(/\s+/g, ' ').trim();
    const titleSeed = normalizedPrompt.slice(0, 24) || 'AI 车贴';
    const title = `${titleSeed}${titleSeed.endsWith('风') ? '' : '风'}`.slice(0, 30);
    const description = `${modelName} · ${normalizedPrompt}`.slice(0, 120);
    return {
        name: title || 'AI 车贴',
        name_en: title || 'AI Wrap',
        description: description || '',
        description_en: description || '',
    };
}

function compactDiagnosticText(input: string, max = 160): string {
    const normalized = String(input || '').replace(/\s+/g, ' ').trim();
    return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function buildFailureDiagnosticSummary(result: Pick<GenerateWrapResult, 'errorCode' | 'promptBlockReason' | 'finishReasons' | 'finishMessages' | 'responseId' | 'modelVersion'>): string {
    const finishReasons = (result.finishReasons || []).join('|') || '-';
    const finishMessage = compactDiagnosticText((result.finishMessages || []).find(Boolean) || '-', 220);
    return [
        `code=${result.errorCode || 'unknown_error'}`,
        `block=${result.promptBlockReason || '-'}`,
        `finish=${finishReasons}`,
        `message=${finishMessage}`,
        `responseId=${result.responseId || '-'}`,
        `modelVersion=${result.modelVersion || '-'}`
    ].join('; ');
}

function mapGenerationFailureForUser(result: Pick<GenerateWrapResult, 'error' | 'errorCode' | 'finishReasons' | 'finishMessages' | 'promptBlockReason' | 'responseId'>) {
    const errorCode = result.errorCode || 'unknown_error';
    const finishReasons = (result.finishReasons || []).map(x => String(x).toUpperCase());
    const finishMessage = (result.finishMessages || []).map(x => String(x).trim()).find(Boolean) || '';
    const promptBlockReason = (result.promptBlockReason || '').toUpperCase();
    const responseIdSuffix = result.responseId ? `（responseId=${result.responseId}）` : '';

    if (errorCode === 'prompt_blocked') {
        const reasonText = promptBlockReason || 'UNKNOWN';
        const detail = finishMessage ? ` 模型反馈：${compactDiagnosticText(finishMessage, 120)}` : '';
        return {
            code: errorCode,
            message: `生成失败：请求被模型策略拦截（${reasonText}）。${detail}${responseIdSuffix}`,
        };
    }

    if (errorCode === 'recitation_blocked') {
        const detail = finishMessage ? ` 模型反馈：${compactDiagnosticText(finishMessage, 120)}` : '';
        return {
            code: errorCode,
            message: `生成失败：触发版权引用限制（RECITATION）。${detail}${responseIdSuffix}`,
        };
    }

    if (errorCode === 'no_image_payload') {
        const reasons = finishReasons.join(',');
        const detail = finishMessage ? ` 模型反馈：${compactDiagnosticText(finishMessage, 120)}` : '';
        return {
            code: errorCode,
            message: `生成失败：模型未返回图片（${reasons || 'UNKNOWN'}）。${detail}${responseIdSuffix}`,
        };
    }

    if (errorCode === 'timeout') {
        return {
            code: errorCode,
            message: `${result.error || '生成失败：AI生成超时，请稍后重试。'}${responseIdSuffix}`,
        };
    }

    return {
        code: errorCode,
        message: `${result.error || 'AI generation failed'}${responseIdSuffix}`,
    };
}

function shouldRetryWithOptimizedPrompt(result: Pick<GenerateWrapResult, 'errorCode' | 'finishReasons'>): boolean {
    const code = String(result.errorCode || '').toLowerCase();
    const reasons = (result.finishReasons || []).map(x => String(x).toUpperCase());

    if (code === 'prompt_blocked' || code === 'recitation_blocked') return true;
    if (code === 'no_image_payload') {
        if (reasons.length === 0) return true;
        return reasons.some(reason => reason === 'OTHER' || reason === 'IMAGE_OTHER' || reason === 'NO_IMAGE');
    }

    return false;
}

function isAllowedReferenceUrl(input: string): boolean {
    if (!input) return false;
    if (input.startsWith('data:')) return true;
    if (!input.startsWith('http')) return false;
    try {
        const url = new URL(input);
        const hostAllowed = allowedReferenceHosts.has(url.hostname.toLowerCase());
        if (!hostAllowed) return false;
        if (!url.pathname.startsWith('/wraps/reference/')) return false;
        const filename = url.pathname.split('/').pop() || '';
        const lastDot = filename.lastIndexOf('.');
        if (lastDot <= 0 || lastDot === filename.length - 1) return false;
        const ext = filename.slice(lastDot + 1).toLowerCase();
        if (!allowedReferenceExtensions.has(ext)) return false;
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
    modelSlug: string;
    referenceImages?: string[];
}) {
    const { userId, prompt, amount, idempotencyKey, modelSlug, referenceImages } = params;
    const client = await db().connect();
    try {
        await client.query('BEGIN');

        // Schema Safety Check (Runs once per request but very fast)
        await client.query(`
            CREATE TABLE IF NOT EXISTS gemini_files_cache (
                id SERIAL PRIMARY KEY,
                cache_key TEXT UNIQUE NOT NULL,
                file_uri TEXT NOT NULL,
                mime_type TEXT,
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                metadata JSONB
            );
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generation_tasks' AND column_name='model_slug') THEN
                    ALTER TABLE generation_tasks ADD COLUMN model_slug TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generation_tasks' AND column_name='reference_images') THEN
                    ALTER TABLE generation_tasks ADD COLUMN reference_images TEXT[];
                END IF;
            END $$;
        `);

        if (idempotencyKey) {
            const { rows: existing } = await client.query(
                `SELECT id, status, updated_at, created_at
                 FROM generation_tasks
                 WHERE idempotency_key = $1 AND user_id = $2
                 LIMIT 1`,
                [idempotencyKey, userId]
            );
            if (existing[0]) {
                const { rows: balanceRows } = await client.query(
                    `SELECT balance FROM user_credits WHERE user_id = $1 LIMIT 1`,
                    [userId]
                );
                const balance = Number(balanceRows[0]?.balance ?? 0);
                let remainingBalance = balance;
                if (existing[0].status === 'pending' || existing[0].status === 'processing') {
                    const { rows: inflightRows } = await client.query(
                        `SELECT COALESCE(SUM(credits_spent), 0)::int AS reserved_credits
                         FROM generation_tasks
                         WHERE user_id = $1
                           AND status IN ('pending', 'processing')`,
                        [userId]
                    );
                    const reservedCredits = Number(inflightRows[0]?.reserved_credits || 0);
                    remainingBalance = Math.max(balance - reservedCredits, 0);
                }
                await client.query('COMMIT');
                return {
                    success: true,
                    taskId: existing[0].id as string,
                    status: existing[0].status,
                    updatedAt: existing[0].updated_at || existing[0].created_at,
                    remainingBalance,
                    errorMsg: 'Idempotent hit'
                };
            }
        }

        await client.query(
            `INSERT INTO user_credits (user_id, balance, total_earned, total_spent, updated_at)
             VALUES ($1, $2, $2, 0, NOW())
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, DEFAULT_FREE_CREDITS]
        );

        const { rows: creditRows } = await client.query(
            `SELECT balance FROM user_credits WHERE user_id = $1 FOR UPDATE`,
            [userId]
        );
        const currentBalance = Number(creditRows[0]?.balance || 0);

        const { rows: inflightRows } = await client.query(
            `SELECT COUNT(*)::int AS inflight_count, COALESCE(SUM(credits_spent), 0)::int AS reserved_credits
             FROM generation_tasks
             WHERE user_id = $1
               AND status IN ('pending', 'processing')`,
            [userId]
        );
        const inflightCount = Number(inflightRows[0]?.inflight_count || 0);
        const reservedCredits = Number(inflightRows[0]?.reserved_credits || 0);
        const availableCredits = Math.max(currentBalance - reservedCredits, 0);

        if (inflightCount >= MAX_INFLIGHT_TASKS_PER_USER) {
            await client.query('ROLLBACK');
            return { success: false, errorMsg: 'Too many tasks in progress. 请等待当前任务完成后再试。' };
        }

        if (availableCredits < amount) {
            await client.query('ROLLBACK');
            return { success: false, errorMsg: 'Insufficient credits or deduction failed' };
        }

        const { rows: taskRows } = await client.query(
            `INSERT INTO generation_tasks (
                user_id, prompt, status, credits_spent, idempotency_key, 
                model_slug, reference_images, created_at, updated_at
             ) VALUES ($1, $2, 'pending', $3, $4, $5, $6, NOW(), NOW())
             RETURNING id`,
            [userId, prompt, amount, idempotencyKey || null, modelSlug, referenceImages || null]
        );

        const taskId = taskRows[0].id as string;

        await client.query('COMMIT');
        return { success: true, taskId, remainingBalance: availableCredits - amount };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function queueGenerationTask(params: {
    taskId: string;
    userId: string;
    modelSlug: string;
    modelName: string;
    prompt: string;
    referenceImages?: string[];
    origin: string;
}) {
    const { taskId, userId, modelSlug, modelName, prompt, referenceImages, origin } = params;
    const queuedStep = {
        step: 'queued_for_worker',
        ts: new Date().toISOString(),
        modelSlug,
        modelName,
        prompt,
        referenceImages: Array.isArray(referenceImages)
            ? referenceImages.filter(ref => typeof ref === 'string').map(ref => ref.trim()).filter(Boolean)
            : [],
        origin
    };

    await dbQuery(
        `UPDATE generation_tasks
         SET status = 'pending',
             next_retry_at = NOW(),
             error_message = NULL,
             finished_at = NULL,
             lease_owner = NULL,
             lease_expires_at = NULL,
             steps = COALESCE(steps, '[]'::jsonb) || $3::jsonb,
             updated_at = NOW()
         WHERE id = $1
           AND user_id = $2`,
        [taskId, userId, JSON.stringify([queuedStep])]
    );
}

async function settleTaskCredits(taskId: string, reason: string) {
    const client = await db().connect();
    try {
        await client.query('BEGIN');

        const { rows: taskRows } = await client.query(
            `SELECT id, user_id, credits_spent
             FROM generation_tasks
             WHERE id = $1
             FOR UPDATE`,
            [taskId]
        );
        const task = taskRows[0];
        if (!task) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Task not found' };
        }

        const { rows: chargedRows } = await client.query(
            `SELECT id
             FROM credit_ledger
             WHERE task_id = $1
               AND type IN ('generation', 'generation_charge')
             LIMIT 1`,
            [taskId]
        );
        if (chargedRows[0]) {
            await client.query('COMMIT');
            return { success: true, alreadyCharged: true };
        }

        const credits = Number(task.credits_spent || 0);
        if (!Number.isFinite(credits) || credits <= 0) {
            await client.query('COMMIT');
            return { success: true, alreadyCharged: true };
        }

        const userId = task.user_id as string;
        const { rows: creditRows } = await client.query(
            `SELECT balance
             FROM user_credits
             WHERE user_id = $1
             FOR UPDATE`,
            [userId]
        );
        if (!creditRows[0]) {
            await client.query('ROLLBACK');
            return { success: false, error: 'User credit row missing' };
        }

        const balance = Number(creditRows[0].balance || 0);
        if (balance < credits) {
            await client.query('ROLLBACK');
            return { success: false, error: 'Insufficient balance at settlement' };
        }

        await client.query(
            `UPDATE user_credits
             SET balance = balance - $2,
                 total_spent = total_spent + $2,
                 updated_at = NOW()
             WHERE user_id = $1`,
            [userId, credits]
        );

        await client.query(
            `INSERT INTO credit_ledger (user_id, task_id, amount, type, description, created_at, metadata)
             VALUES ($1, $2, $3, 'generation_charge', $4, NOW(), $5::jsonb)`,
            [userId, taskId, -credits, reason, JSON.stringify({ phase: 'settle' })]
        );

        await client.query('COMMIT');
        return { success: true, charged: credits };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function refundTaskCredits(taskId: string, reason: string) {
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

        const { rows: chargedRows } = await client.query(
            `SELECT amount, type
             FROM credit_ledger
             WHERE task_id = $1
               AND type IN ('generation', 'generation_charge')
             ORDER BY created_at ASC
             LIMIT 1`,
            [taskId]
        );

        const chargedLedger = chargedRows[0];
        const credits = chargedLedger ? Math.abs(Number(chargedLedger.amount || task.credits_spent || 0)) : 0;
        const userId = task.user_id as string;

        if (credits > 0) {
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
        }

        await client.query(
            `INSERT INTO credit_ledger (user_id, task_id, amount, type, description, created_at)
             VALUES ($1, $2, $3, 'refund', $4, NOW())`,
            [userId, taskId, credits > 0 ? credits : 0, credits > 0 ? reason : `${reason} (no charged credits to refund)`]
        );

        await client.query(
            `UPDATE generation_tasks
             SET status = 'failed_refunded',
                 steps = COALESCE(steps, '[]'::jsonb) || $2::jsonb,
                 error_message = COALESCE(error_message, $3),
                 finished_at = NOW(),
                 lease_owner = NULL,
                 lease_expires_at = NULL,
                 next_retry_at = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [
                taskId,
                JSON.stringify([{ step: 'refunded', ts: new Date().toISOString(), reason }]),
                reason
            ]
        );

        await client.query('COMMIT');
        return { success: true, refunded: credits > 0, credits };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function processGenerationTask(params: {
    taskId: string;
    userId: string;
    modelSlug: string;
    modelName: string;
    prompt: string;
    referenceImages?: string[];
    origin: string;
}) {
    const { taskId, userId, modelSlug, modelName, prompt, referenceImages: inputReferenceImages, origin } = params;
    const requestId = `task-${taskId.substring(0, 8)}`;
    console.log(`[AI-GEN] [${requestId}] Starting background worker for task ${taskId}`);

    const logStep = async (step: string, status?: string, reason?: string, metadata?: Record<string, unknown>) => {
        try {
            await logTaskStep(taskId, step, status, reason, metadata);
        } catch (e) {
            console.error(`[AI-GEN] [${requestId}] Failed to log step ${step}:`, e);
        }
    };

    const markTaskFailed = async (error: string) => {
        try {
            await dbQuery(
                `UPDATE generation_tasks
                 SET status = 'failed',
                     error_message = $2,
                     finished_at = NOW(),
                     lease_owner = NULL,
                     lease_expires_at = NULL,
                     next_retry_at = NULL,
                     updated_at = NOW()
                 WHERE id = $1`,
                [taskId, error]
            );
        } catch (e) {
            console.error(`[AI-GEN] [${requestId}] Failed to mark task failed:`, e);
        }
    };

    try {
        // 0. Ensure schema exists
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS gemini_files_cache (
                id SERIAL PRIMARY KEY,
                cache_key TEXT UNIQUE NOT NULL,
                file_uri TEXT NOT NULL,
                mime_type TEXT,
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                metadata JSONB
            );
            CREATE INDEX IF NOT EXISTS idx_gemini_files_cache_key ON gemini_files_cache(cache_key);
            CREATE INDEX IF NOT EXISTS idx_gemini_files_cache_expires ON gemini_files_cache(expires_at);
        `);

        await logStep('worker_started', 'processing');

        // 1. 先标记处理中
        await logStep('ai_call_start', 'processing');
        await dbQuery(
            `UPDATE generation_tasks
             SET status = 'processing',
                 started_at = COALESCE(started_at, NOW()),
                 attempts = CASE WHEN status = 'pending' THEN attempts + 1 ELSE attempts END,
                 updated_at = NOW()
             WHERE id = $1 AND user_id = $2`,
            [taskId, userId]
        );

        // 2. 获取 Mask
        const maskDimensions = getMaskDimensions(modelSlug);
        const maskUrl = getMaskUrl(modelSlug, origin);
        await logStep('mask_selected', undefined, undefined, {
            maskUrl,
            maskDimensions: `${maskDimensions.width}x${maskDimensions.height}`,
            modelSlug
        });

        // --- DEBUG: Log resolution info ---
        console.log(`[AI-GEN] [Task:${taskId}] ModelSlug: "${modelSlug}", Dimensions: ${maskDimensions.width}x${maskDimensions.height} (${maskDimensions.aspectRatio})`);
        if (!MASK_DIMENSIONS[modelSlug]) {
            console.warn(`[AI-GEN] [Task:${taskId}] ⚠️ Using fallback dimensions for slug: "${modelSlug}"`);
        }
        // -----------------------------------

        // New mask fetching logic
        let geminiMaskUri: string | undefined;
        try {
            await logStep('prepare_mask_start');
            geminiMaskUri = await getGeminiFileUri({
                cacheKey: `mask:${modelSlug}`,
                assetUrl: maskUrl,
                mimeType: 'image/png',
                displayName: `${modelSlug}_mask`
            });
            await logStep('prepare_mask_success', undefined, `uri=${geminiMaskUri}`);
        } catch (maskErr) {
            console.error(`[AI-GEN] [${requestId}] Failed to prepare Gemini Mask URI:`, maskErr);
            await logStep('prepare_mask_failed', 'processing', String(maskErr));
            // Fallback will be handled by generateWrapTexture if we pass undefined, but Gemini Files is now preferred.
        }

        // Original mask fetch (now fallback if Gemini Files fails or is not used)
        let maskImageBase64: string | null = null;
        if (!geminiMaskUri) {
            try {
                console.log(`[AI-GEN] [Task:${taskId}] Fetching mask from: ${maskUrl}`);
                const maskResponse = await fetch(maskUrl, { headers: { 'Referer': 'https://myteslab.com' } });

                if (maskResponse.ok) {
                    const maskBuffer = Buffer.from(await maskResponse.arrayBuffer());
                    console.log(`[AI-GEN] [Task:${taskId}] Mask fetched. Size: ${maskBuffer.length} bytes`);
                    maskImageBase64 = maskBuffer.toString('base64');
                    await logStep('mask_load_success', 'processing', `Loaded ${maskBuffer.length} bytes`);

                } else {
                    console.error(`[AI-GEN] [Task:${taskId}] ❌ Failed to fetch mask. Status: ${maskResponse.status}`);
                    await logStep('mask_load_failed', 'failed', `HTTP ${maskResponse.status}`);
                }
            } catch (error: any) {
                console.error(`[AI-GEN] [Task:${taskId}] ❌ Mask fetch exception:`, error);
                await logStep('mask_load_failed', 'failed', error.message || 'Exception during fetch');
            }
        }


        if (!geminiMaskUri && !maskImageBase64) {
            await markTaskFailed('Mask fetch failed');
            await refundTaskCredits(taskId, 'Mask fetch failed');
            return;
        }

        // 3. 参考图准备（默认直接使用前端上传后的 URL，不再后端重复上传）
        const referenceImageUris: string[] = [];
        const referenceImagesBase64: string[] = [];
        const savedReferenceUrls: string[] = []; // This will now store original URLs for logging/fallback

        if (inputReferenceImages && Array.isArray(inputReferenceImages) && inputReferenceImages.length > 0) {
            console.log(`[AI-GEN] Processing ${inputReferenceImages.length} reference images...`);
            await logStep('prepare_refs_start');
            for (let i = 0; i < inputReferenceImages.length; i++) {
                const inputRef = inputReferenceImages[i];
                if (typeof inputRef !== 'string') continue;
                const ref = inputRef.trim();
                if (!ref) continue;

                if (ref.startsWith('http')) {
                    savedReferenceUrls.push(ref); // Store original URL
                    try {
                        const uri = await getGeminiFileUri({
                            cacheKey: ref, // Use URL as cache key for reference images
                            assetUrl: ref,
                            mimeType: 'image/jpeg', // Most references are JPEG optimized in our frontend
                            displayName: `reference_${i}`
                        });
                        referenceImageUris.push(uri);
                    } catch (refErr) {
                        console.error(`[AI-GEN] [${requestId}] Failed to prepare Gemini Reference URI for ${ref}:`, refErr);
                        // Continue processing other references, but this one won't use Gemini Files API
                    }
                    continue;
                }

                const payload = extractBase64Payload(ref);
                if (!payload) continue;
                if (estimateBase64Size(payload) > MAX_REFERENCE_IMAGE_BYTES) {
                    throw new Error('Reference image too large');
                }
                referenceImagesBase64.push(payload);
            }
            await logStep('prepare_refs_complete', undefined, `uris=${referenceImageUris.length}, inline=${referenceImagesBase64.length}`);
        }

        // const savedReferenceUrls = Array.from(new Set(referenceImageUrls)); // No longer needed, savedReferenceUrls is built above
        const dedupedReferenceImageUrls = Array.from(new Set(savedReferenceUrls)); // Use the collected original URLs
        console.log(
            `[AI-GEN] [Task:${taskId}] Reference payload prepared. GeminiURIs=${referenceImageUris.length}, URLs=${dedupedReferenceImageUrls.length}, inline=${referenceImagesBase64.length}`
        );

        console.log(`[AI-GEN] Starting Gemini image generation...`);
        const metadata = buildLocalWrapMetadata(prompt, modelName);
        let finalPromptUsed = prompt;
        let optimizedPromptUsed: string | null = null;

        let result = await generateWrapTexture({
            modelSlug,
            modelName,
            prompt: finalPromptUsed,
            maskFileUri: geminiMaskUri, // Pass Gemini File URI
            maskImageBase64: geminiMaskUri ? undefined : maskImageBase64 || undefined, // Fallback to base64 if no URI
            referenceFileUris: referenceImageUris.length > 0 ? referenceImageUris : undefined, // Pass Gemini File URIs
            referenceImagesBase64: referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined, // Still pass base64 directly
            // Also pass original URLs as fallback or for logging if needed, if Gemini URIs are not used for them
            maskImageUrl: geminiMaskUri ? undefined : maskUrl,
            referenceImageUrls: referenceImageUris.length === 0 && dedupedReferenceImageUrls.length > 0 ? dedupedReferenceImageUrls : undefined,
        });

        if (!result.success && ENABLE_PROMPT_OPTIMIZE_RETRY && shouldRetryWithOptimizedPrompt(result)) {
            await logStep('ai_first_attempt_failed', 'processing', buildFailureDiagnosticSummary(result));

            const optimization = await optimizePromptForPolicyRetry({
                userPrompt: prompt,
                modelName,
                failureSignal: {
                    errorCode: result.errorCode,
                    promptBlockReason: result.promptBlockReason || null,
                    finishReasons: result.finishReasons || [],
                    finishMessages: result.finishMessages || []
                }
            });

            if (optimization.success && optimization.changed && optimization.optimizedPrompt.trim()) {
                optimizedPromptUsed = optimization.optimizedPrompt.trim();
                finalPromptUsed = optimizedPromptUsed;
                await logStep(
                    'prompt_retry_optimized',
                    'processing',
                    `reason=${compactDiagnosticText(optimization.reason || '-', 120)}; responseId=${optimization.responseId || '-'}; modelVersion=${optimization.modelVersion || '-'}`
                );

                result = await generateWrapTexture({
                    modelSlug,
                    modelName,
                    prompt: finalPromptUsed,
                    maskImageUrl: maskUrl,
                    maskImageBase64: maskImageBase64 || undefined,
                    referenceImageUrls: dedupedReferenceImageUrls.length > 0 ? dedupedReferenceImageUrls : undefined,
                    referenceImagesBase64: referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined,
                });

                if (result.success) {
                    await logStep('prompt_retry_success', 'processing');
                } else {
                    await logStep('prompt_retry_failed', 'processing', buildFailureDiagnosticSummary(result));
                }
            } else {
                const skipReason = optimization.success
                    ? 'optimizer_returned_same_prompt'
                    : `optimizer_error=${compactDiagnosticText(optimization.error || 'unknown', 160)}`;
                await logStep('prompt_retry_skipped', 'processing', skipReason);
            }
        }

        const assembledPrompt = (result.finalPrompt || '').trim();
        if (assembledPrompt) {
            await logStep('prompt_assembled', undefined, undefined, {
                assembledPrompt,
                promptRetryApplied: Boolean(optimizedPromptUsed)
            });
        }
        if (result.requestPayload) {
            await logStep('gemini_request_payload', undefined, undefined, {
                requestPayload: result.requestPayload,
                requestModel: result.requestModel || null,
                requestMode: result.requestMode || null,
                requestApiUrl: result.requestApiUrl || null,
                requestAttempt: result.requestAttempt || null
            });
        }

        if (!result.success) {
            console.error(`[AI-GEN] AI generation failed, triggering refund for task ${taskId}, user ${userId}...`);
            const mappedFailure = mapGenerationFailureForUser(result);
            const diagnosticSummary = buildFailureDiagnosticSummary(result);
            await logStep('ai_call_failed', 'failed', diagnosticSummary);
            await markTaskFailed(mappedFailure.message);
            await refundTaskCredits(taskId, `AI generation failed: ${mappedFailure.message}`);
            return;
        }

        await logStep(
            'ai_response_received',
            undefined,
            `responseId=${result.responseId || '-'}; modelVersion=${result.modelVersion || '-'}; promptRetry=${optimizedPromptUsed ? '1' : '0'}`
        );
        if (optimizedPromptUsed) {
            await logStep('prompt_retry_applied', undefined, `prompt=${compactDiagnosticText(optimizedPromptUsed, 160)}`);
        }

        if (!result.dataUrl) {
            await markTaskFailed('AI generated image but no data returned');
            await refundTaskCredits(taskId, 'AI generated image but no data returned');
            return;
        }

        const settleResult = await settleTaskCredits(taskId, 'AI generation settled after successful image response');
        if (!settleResult.success) {
            await markTaskFailed(`Credit settlement failed: ${settleResult.error || 'unknown error'}`);
            await logStep('credit_settlement_failed', 'failed', settleResult.error || 'unknown error');
            return;
        }
        await logStep('credit_settled');

        let savedUrl = result.dataUrl;

        try {
            const filename = `wrap-${taskId.substring(0, 8)}-${Date.now()}.png`;

            const base64Data = result.dataUrl.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            await logStep('oss_upload_start');

            try {
                const rawUrl = await uploadToOSS(buffer, filename, 'wraps/ai-generated');
                if (modelSlug.includes('cybertruck')) {
                    savedUrl = `${rawUrl}?x-oss-process=image/rotate,90/resize,w_1024,h_768`;
                } else {
                    savedUrl = `${rawUrl}?x-oss-process=image/rotate,180/resize,w_1024,h_1024`;
                }
                await logStep('oss_upload_success');
            } catch (ossErr) {
                console.error(`[AI-GEN] OSS Upload failed for task ${taskId}, user ${userId}:`, ossErr);
                await markTaskFailed('OSS upload failed');
                await refundTaskCredits(taskId, 'OSS upload failed');
                return;
            }
        } catch (err) {
            console.error(`❌ [AI-GEN] Image processing error for task ${taskId}, user ${userId}:`, err);
            await markTaskFailed('Image processing failed');
            await refundTaskCredits(taskId, 'Image processing failed');
            return;
        }

        await logStep('database_save_start');

        const slugBase = buildSlugBase({
            name: metadata.name,
            nameEn: metadata.name_en,
            prompt,
            modelSlug
        });
        const slug = await ensureUniqueSlug(slugBase);

        let wrapId: string | undefined;

        try {
            const { rows: wrapRows } = await dbQuery(
                `INSERT INTO wraps (
                    user_id, name, name_en, description_en, prompt, model_slug,
                    texture_url, preview_url, is_public, category, reference_images, generation_task_id, slug
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,
                    $7,$8,$9,$10,$11::text[],$12,$13
                ) RETURNING id, slug`,
                [
                    userId,
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

            wrapId = wrapRows[0]?.id;

            if (!wrapId) {
                throw new Error('Failed to get wrap ID from database');
            }
        } catch (dbErr) {
            console.error(`❌ [AI-GEN] Database save failed for task ${taskId}, user ${userId}:`, dbErr);
            await logStep('database_save_failed', undefined, dbErr instanceof Error ? dbErr.message : 'Database error');
            await dbQuery(
                `UPDATE generation_tasks
                 SET status = 'completed',
                     error_message = COALESCE(error_message, $2),
                     finished_at = NOW(),
                     lease_owner = NULL,
                     lease_expires_at = NULL,
                     next_retry_at = NULL,
                     steps = COALESCE(steps, '[]'::jsonb) || $3::jsonb,
                     updated_at = NOW()
                 WHERE id = $1`,
                [
                    taskId,
                    `Wrap save fallback: ${dbErr instanceof Error ? dbErr.message : 'Unknown error'}`,
                    JSON.stringify([{ step: 'completed_with_saved_url', ts: new Date().toISOString(), savedUrl }])
                ]
            );
            await logStep('completed_with_saved_url', 'completed', savedUrl);
            return;
        }

        if (wrapId) {
            await dbQuery(
                `UPDATE generation_tasks
                 SET status = 'completed',
                     wrap_id = $2,
                     finished_at = NOW(),
                     lease_owner = NULL,
                     lease_expires_at = NULL,
                     next_retry_at = NULL,
                     updated_at = NOW()
                 WHERE id = $1 AND user_id = $3`,
                [taskId, wrapId, userId]
            );
        }

        await logStep('database_save_success');
        await logStep('completed', 'completed');

        console.log(`[AI-GEN] Task ${taskId} completed. Wrap ${wrapId} saved.`);
        return;

    } catch (error: any) {
        console.error('❌ [AI-GEN] Background task error:', error);
        try {
            await markTaskFailed(`Global API Error: ${error instanceof Error ? error.message : String(error)}`);
            await logTaskStep(taskId, 'failed', 'failed', `Global Error: ${error instanceof Error ? error.message : String(error)}`);
            await refundTaskCredits(taskId, `Global API Error: ${error instanceof Error ? error.message : String(error)}`);
        } catch (innerErr) {
            console.error('[AI-GEN] Failed to finalize error handling:', innerErr);
        }
    }
}

export async function POST(request: NextRequest) {
    let taskId: string | undefined;

    const requestId = crypto.randomUUID();
    console.log(`[AI-GEN] [${requestId}] Request received. Content-Length: ${request.headers.get('content-length')}`);

    try {
        // 1. 身份验证 (Authentication)
        const user = await getSessionUser();
        if (!user) {
            console.warn(`[AI-GEN] [${requestId}] Unauthorized`);
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        const forwardedFor = request.headers.get('x-forwarded-for') || '';
        const clientIp = forwardedFor.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

        if (!takeRateQuota(userRateMap, user.id, PER_USER_WINDOW_MS, PER_USER_MAX_REQUESTS)) {
            return NextResponse.json({
                success: false,
                error: '请求过于频繁，请稍后再试。'
            }, { status: 429 });
        }
        if (!takeRateQuota(ipRateMap, clientIp, PER_IP_WINDOW_MS, PER_IP_MAX_REQUESTS)) {
            return NextResponse.json({
                success: false,
                error: '当前网络请求过于频繁，请稍后再试。'
            }, { status: 429 });
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
        const normalizedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
        if (typeof modelSlug !== 'string' || !normalizedPrompt) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }
        if (normalizedPrompt.length < 3 || normalizedPrompt.length > 400) {
            return NextResponse.json({ success: false, error: '提示词长度需在 3 到 400 字之间' }, { status: 400 });
        }
        if (idempotencyKey && (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 128)) {
            return NextResponse.json({ success: false, error: 'Invalid idempotency key' }, { status: 400 });
        }
        if (idempotencyKey && !/^[a-zA-Z0-9_-]+$/.test(idempotencyKey)) {
            return NextResponse.json({ success: false, error: 'Invalid idempotency key format' }, { status: 400 });
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

        const currentModelSlug = modelSlug.toLowerCase().trim();
        let modelName: string | undefined;
        try {
            const { rows } = await dbQuery<{ name: string; name_en: string }>(
                `SELECT name, name_en
                 FROM wrap_models
                 WHERE is_active = true AND slug = $1
                 LIMIT 1`,
                [currentModelSlug]
            );
            if (rows[0]) {
                modelName = rows[0].name || rows[0].name_en;
            }
        } catch (dbErr) {
            console.error('[AI-GEN] Failed to load model from DB, fallback to config:', dbErr);
        }

        if (!modelName) {
            const fallback = getModelBySlug(currentModelSlug);
            modelName = fallback?.name;
        }

        if (!modelName) {
            console.error(`[AI-GEN] Invalid model slug received: "${modelSlug}"`);
            return NextResponse.json({
                success: false,
                error: `Invalid model: ${modelSlug}. 请检查数据库 slug 是否在允许列表中。`
            }, { status: 400 });
        }

        // 3. 执行数据库原子扣费 RPC (带幂等支持)
        const requiredCredits = getServiceCost(ServiceType.AI_GENERATION);

        const deductResultRaw = await deductCreditsForGeneration({
            userId: user.id,
            prompt: normalizedPrompt,
            amount: requiredCredits,
            idempotencyKey: idempotencyKey || null,
            modelSlug: currentModelSlug,
            referenceImages: referenceImages || null
        });

        if (!deductResultRaw?.success) {
            const message = deductResultRaw?.errorMsg || 'Insufficient credits or deduction failed';
            const statusCode = message.startsWith('Too many tasks') ? 429 : 402;
            return NextResponse.json({
                success: false,
                error: message
            }, { status: statusCode });
        }

        taskId = deductResultRaw.taskId;
        if (!taskId) {
            throw new Error('Task ID is missing from deduction result');
        }

        // 3.1 幂等碰撞处理 (Idempotency Handling)
        if (deductResultRaw.errorMsg === 'Idempotent hit') {
            const taskStatus = (deductResultRaw as any).status;
            const taskUpdatedAtRaw = (deductResultRaw as any).updatedAt;
            const staleMs = Number(process.env.WRAP_TASK_STALE_MS ?? 10 * 60 * 1000);
            console.log(`[AI-GEN] ♻️ Idempotency hit: ${taskId}, Existing Status: ${taskStatus}`);

            // Recover stale in-flight tasks (e.g. deployment restart interrupted async worker).
            if ((taskStatus === 'pending' || taskStatus === 'processing') && taskUpdatedAtRaw) {
                const taskUpdatedAt = new Date(taskUpdatedAtRaw).getTime();
                const ageMs = Date.now() - taskUpdatedAt;
                if (Number.isFinite(ageMs) && ageMs > staleMs) {
                    if (!taskId) {
                        throw new Error('Task ID is missing on stale task recovery');
                    }
                    console.warn(`[AI-GEN] ⚠️ Detected stale task ${taskId} (age=${Math.round(ageMs / 1000)}s), auto-refunding and allowing retry.`);
                    await dbQuery(
                        `UPDATE generation_tasks
                         SET status = 'failed',
                             error_message = COALESCE(error_message, $2),
                             finished_at = NOW(),
                             lease_owner = NULL,
                             lease_expires_at = NULL,
                             next_retry_at = NULL,
                             updated_at = NOW()
                         WHERE id = $1 AND user_id = $3`,
                        [taskId, 'Stale generation task detected (interrupted before completion)', user.id]
                    );
                    await refundTaskCredits(taskId, 'Auto refund: stale generation task');
                    return NextResponse.json({
                        success: false,
                        error: '检测到上一次任务卡住，已自动重置并退款。请重新点击生成。',
                        taskId,
                        status: 'failed'
                    }, { status: 200 });
                }
            }

            // 如果已成功，尝试返回作品
            if (taskStatus === 'completed') {
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
            }

            // 如果正在处理中，告诉前端继续等待
            if (taskStatus === 'pending' || taskStatus === 'processing') {
                if (ENABLE_SUBMIT_WORKER_PATH && taskStatus === 'pending') {
                    await queueGenerationTask({
                        taskId,
                        userId: user.id,
                        modelSlug: currentModelSlug,
                        modelName,
                        prompt: normalizedPrompt,
                        referenceImages,
                        origin: request.nextUrl.origin
                    });
                }
                return jsonAccepted({
                    success: true,
                    taskId,
                    status: 'pending',
                    remainingBalance: deductResultRaw?.remainingBalance ?? 0,
                    retryAfter: RETRY_AFTER_SECONDS
                });
            }

            // 如果之前失败了，且在同一个幂等时窗内，返回之前的错误
            if (taskStatus === 'failed' || taskStatus === 'failed_refunded') {
                const { rows: taskRows } = await dbQuery(
                    `SELECT error_message FROM generation_tasks WHERE id = $1 LIMIT 1`,
                    [taskId]
                );
                return NextResponse.json({
                    success: false,
                    error: taskRows[0]?.error_message || 'Task failed previously',
                    taskId,
                    status: 'failed'
                }, { status: 200 }); // 返回 200 但 success: false，由前端处理
            }
        }

        if (!taskId) {
            throw new Error('Task ID is missing');
        }

        console.log(`[AI-GEN] ✅ Task active: ${taskId}`);

        if (ENABLE_SUBMIT_WORKER_PATH) {
            await queueGenerationTask({
                taskId,
                userId: user.id,
                modelSlug: currentModelSlug,
                modelName,
                prompt: normalizedPrompt,
                referenceImages,
                origin: request.nextUrl.origin
            });
            return jsonAccepted({
                success: true,
                taskId,
                status: 'pending',
                mode: 'queued',
                remainingBalance: deductResultRaw?.remainingBalance ?? 0,
                retryAfter: RETRY_AFTER_SECONDS
            });
        }

        // 兼容路径：未开启 submit-only 时，保持当前进程内异步处理
        void processGenerationTask({
            taskId,
            userId: user.id,
            modelSlug: currentModelSlug,
            modelName,
            prompt: normalizedPrompt,
            referenceImages,
            origin: request.nextUrl.origin
        });

        return jsonAccepted({
            success: true,
            taskId,
            status: 'pending',
            mode: ENABLE_SUBMIT_ONLY && !ENABLE_WORKER ? 'inline_async_worker_disabled' : 'inline_async',
            remainingBalance: deductResultRaw?.remainingBalance ?? 0,
            retryAfter: RETRY_AFTER_SECONDS
        });

    } catch (error: any) {
        console.error('❌ [AI-GEN] Global API Error:', error);

        if (taskId) {
            try {
                await dbQuery(
                    `UPDATE generation_tasks
                     SET status = 'failed',
                         error_message = $2,
                         finished_at = NOW(),
                         lease_owner = NULL,
                         lease_expires_at = NULL,
                         next_retry_at = NULL,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [taskId, `Global API Error: ${error instanceof Error ? error.message : String(error)}`]
                );
            } catch (markErr) {
                console.error('[AI-GEN] Failed to mark task failed in API error handler:', markErr);
            }
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
