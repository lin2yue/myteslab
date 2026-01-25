/**
 * API Route: /api/wrap/generate
 * Handles AI wrap texture generation requests
 */

// Import proxy configuration first
import '@/lib/proxy-config';

import { NextRequest, NextResponse } from 'next/server';
import { generateWrapTexture, imageUrlToBase64 } from '@/lib/ai/gemini-image';
import { uploadToOSS } from '@/lib/oss';
import { getMaskUrl, getMaskDimensions } from '@/lib/ai/mask-config';
import { createClient } from '@/utils/supabase/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

// Model slug to display name mapping
const MODEL_NAMES: Record<string, string> = {
    'cybertruck': 'Cybertruck',
    'model-3': 'Model 3',
    'model-3-2024-plus': 'Model 3 2024+',
    'model-y-pre-2025': 'Model Y',
    'model-y-2025-plus': 'Model Y 2025+',
};


export async function POST(request: NextRequest) {
    let taskId: string | undefined;
    const supabase = await createClient();

    try {
        // 1. 身份验证 (Authentication)
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { modelSlug, prompt, referenceImages, idempotencyKey } = body;

        // 2. 参数校验
        if (!modelSlug || !prompt) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        const modelName = MODEL_NAMES[modelSlug];
        if (!modelName) {
            return NextResponse.json({ success: false, error: 'Invalid model' }, { status: 400 });
        }

        // 3. 执行数据库原子扣费 RPC (带幂等支持)
        const { data: deductResultRaw, error: rpcError } = await supabase.rpc('deduct_credits_for_generation', {
            p_prompt: prompt,
            p_amount: 5,
            p_idempotency_key: idempotencyKey || null
        });

        if (rpcError || !deductResultRaw?.[0]?.success) {
            return NextResponse.json({
                success: false,
                error: deductResultRaw?.[0]?.error_msg || 'Insufficient credits or deduction failed'
            }, { status: 402 });
        }

        taskId = deductResultRaw[0].task_id;

        // 如果是幂等命中，且任务已经完成，直接返回结果 (理想情况下这里应该查询任务结果)
        if (deductResultRaw[0].error_msg === 'Idempotent hit') {
            console.log(`[AI-GEN] ♻️ Idempotency hit: ${taskId}`);
            // TODO: 这里可以优化为：如果任务已经完成，直接查询 wraps 表并返回
        }

        console.log(`[AI-GEN] ✅ Task active: ${taskId}`);

        const currentModelSlug = modelSlug.toLowerCase();
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

                // 【调试部分】保存发送给 AI 的 Mask
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

                    // 处理可能带有的 data:image/xxx;base64, 前缀
                    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                    let buffer;
                    if (matches) {
                        buffer = Buffer.from(matches[2], 'base64');
                    } else if (base64Data.includes(',')) {
                        buffer = Buffer.from(base64Data.split(',')[1], 'base64');
                    } else {
                        buffer = Buffer.from(base64Data, 'base64');
                    }

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
                const base64 = refImage.startsWith('http') ? await imageUrlToBase64(refImage) : refImage.split(',')[1];
                if (base64) referenceImagesBase64.push(base64);
            }
        }

        // 5. 调用 AI 生成
        // 更新任务状态为处理中，记录步骤
        console.log(`[AI-GEN] Setting task status to processing for task ${taskId}...`);
        try {
            await supabase.from('generation_tasks').update({
                status: 'processing',
                updated_at: new Date().toISOString(),
                steps: supabase.rpc('append_task_step', { p_task_id: taskId, p_step: 'ai_call_start' }) // 假设有辅助函数，如果没有直接在下面用 SQL 风格更新
            }).eq('id', taskId);

            // 简单的步骤更新逻辑：直接追加
            const { data: taskData } = await supabase.from('generation_tasks').select('steps').eq('id', taskId).single();
            const newSteps = [...(Array.isArray(taskData?.steps) ? taskData.steps : []), { step: 'ai_call_start', ts: new Date().toISOString() }];
            await supabase.from('generation_tasks').update({ steps: newSteps }).eq('id', taskId);

        } catch (updateErr) {
            console.error('[AI-GEN] ❌ Failed to update task status to processing:', updateErr);
        }

        const result = await generateWrapTexture({
            modelSlug,
            modelName,
            prompt,
            maskImageBase64: maskImageBase64 || undefined,
            referenceImagesBase64: referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined,
        });

        // 6. 处理结果
        if (!result.success) {
            // 失败：更新任务状态并自动退款
            console.error(`[AI-GEN] AI generation failed, triggering refund for task ${taskId}...`);
            await supabase.rpc('refund_task_credits', {
                p_task_id: taskId,
                p_reason: `AI API Error: ${result.error}`
            });

            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

        // 7. 成功：记录结果并返回
        if (!result.dataUrl) {
            return NextResponse.json({ success: false, error: 'AI generated image but no data returned' }, { status: 500 });
        }

        let savedUrl = result.dataUrl;
        let correctedDataUrl = result.dataUrl;

        try {
            if (!taskId) throw new Error('Task ID is missing');
            const filename = `wrap-${taskId.substring(0, 8)}-${Date.now()}.png`;
            // @ts-ignore
            const sharp = (await import('sharp')).default;

            const base64Data = result.dataUrl.replace(/^data:image\/\w+;base64,/, '');
            let buffer = Buffer.from(base64Data, 'base64');

            // 1. 获取 Mask 的尺寸作为目标尺寸
            const maskDimensions = getMaskDimensions(currentModelSlug);
            const targetWidth = maskDimensions.width;
            const targetHeight = maskDimensions.height;
            console.log(`[AI-GEN] Target dimensions for ${currentModelSlug}: ${targetWidth}x${targetHeight}`);

            // 2. 执行纠偏和校正
            let pipe = sharp(buffer);
            pipe = pipe.resize(targetWidth, targetHeight, { fit: 'fill' });

            // 3. 执行旋转校正
            if (currentModelSlug.includes('cybertruck')) {
                pipe = pipe.rotate(90).resize(1024, 768, { fit: 'fill' });
            } else {
                pipe = pipe.rotate(180).resize(1024, 1024, { fit: 'fill' });
            }

            const finalBuffer = await pipe.png().toBuffer();
            correctedDataUrl = `data:image/png;base64,${finalBuffer.toString('base64')}`;

            // 4. 上传到云端 OSS
            try {
                savedUrl = await uploadToOSS(finalBuffer, filename, 'wraps/ai-generated');
            } catch (ossErr) {
                console.error('OSS Upload failed:', ossErr);
                await supabase.rpc('refund_task_credits', { p_task_id: taskId, p_reason: 'OSS upload failed' });
                return NextResponse.json({ success: false, error: 'Storage upload failed' }, { status: 500 });
            }

        } catch (err) {
            console.error('❌ [AI-GEN] Image processing error:', err);
            await supabase.rpc('refund_task_credits', { p_task_id: taskId, p_reason: 'Image processing failed' });
            return NextResponse.json({ success: false, error: 'Image correction failed' }, { status: 500 });
        }

        // 插入到统一的作品表 wraps
        const { data: wrapData, error: historyError } = await supabase.from('wraps').insert({
            user_id: user.id,
            name: (prompt || 'AI生成贴纸').substring(0, 50),
            prompt: prompt,
            model_slug: modelSlug,
            texture_url: savedUrl,
            preview_url: savedUrl,
            is_public: false,
            category: 'community',
            reference_images: savedReferenceUrls
        }).select('id').single();

        if (historyError) {
            console.error('Failed to save history:', historyError);
            return NextResponse.json({ success: false, error: 'Failed to save result' }, { status: 500 });
        }

        const wrapId = wrapData?.id;

        // 更新任务状态为已完成，记录最终步骤
        const { data: finalTaskData } = await supabase.from('generation_tasks').select('steps').eq('id', taskId).single();
        const finalSteps = [...(Array.isArray(finalTaskData?.steps) ? finalTaskData.steps : []), { step: 'completed', ts: new Date().toISOString() }];

        await supabase.from('generation_tasks')
            .update({ status: 'completed', steps: finalSteps, updated_at: new Date().toISOString() })
            .eq('id', taskId);

        return NextResponse.json({
            success: true,
            taskId,
            wrapId,
            image: {
                dataUrl: correctedDataUrl,
                mimeType: result.mimeType,
                savedUrl: savedUrl
            },
            remainingBalance: deductResultRaw?.[0]?.remaining_balance ?? 0
        });

    } catch (error: any) {
        console.error('❌ [AI-GEN] Global API Error:', error);

        if (taskId) {
            try {
                console.log(`[AI-GEN] Triggering emergency auto-refund for task ${taskId} due to global error...`);
                const { data: refundRes } = await supabase.rpc('refund_task_credits', {
                    p_task_id: taskId,
                    p_reason: `Global API Error: ${error instanceof Error ? error.message : String(error)}`
                });
                console.log(`[AI-GEN] Emergency refund result:`, refundRes);
            } catch (innerErr) {
                console.error('[AI-GEN] Failed to refund task credits in exit handler:', innerErr);
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
