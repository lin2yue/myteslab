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
    try {
        // 1. 身份验证 (Authentication)
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { modelSlug, prompt, referenceImages } = body;

        // 2. 参数校验
        if (!modelSlug || !prompt) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        const modelName = MODEL_NAMES[modelSlug];
        if (!modelName) {
            return NextResponse.json({ success: false, error: 'Invalid model' }, { status: 400 });
        }

        // 3. 执行数据库原子扣费 RPC
        // 这个函数会检查余额 -> 扣费 -> 创建任务记录，全部在数据库事务中完成
        const { data: deductResult, error: rpcError } = await supabase.rpc('deduct_credits_for_generation', {
            p_prompt: prompt,
            p_amount: 5 // 每次消耗 5 积分
        });

        if (rpcError || !deductResult?.[0]?.success) {
            return NextResponse.json({
                success: false,
                error: deductResult?.[0]?.error_msg || 'Insufficient credits or deduction failed'
            }, { status: 402 });
        }

        const taskId = deductResult[0].task_id;

        const currentModelSlug = modelSlug.toLowerCase();
        let maskImageBase64: string | null = null;
        try {
            const maskUrl = getMaskUrl(currentModelSlug, request.nextUrl.origin);
            const maskResponse = await fetch(maskUrl);

            if (maskResponse.ok) {
                const maskBuffer = Buffer.from(await maskResponse.arrayBuffer());

                // 已经使用了你上传到线上的“预旋转”Mask，因此不需要再做预处理旋转
                console.log(`[AI-GEN] Input processing: Fetched corrected mask from ${maskUrl}`);

                maskImageBase64 = maskBuffer.toString('base64');

                // 【调试部分】保存发送给 AI 的 Mask
                try {
                    const debugBaseDir = join(process.cwd(), '../../dev-studio/test-previews');
                    const taskDebugDir = join(debugBaseDir, taskId);
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
            console.error('Mask processing failed:', error);
        }

        // 4. 处理并转存参考图 (Optional Reference Images)
        const savedReferenceUrls: string[] = [];
        if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
            console.log(`[AI-GEN] Processing ${referenceImages.length} reference images for taskId: ${taskId}`);
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
                } catch (e) {
                    console.error(`[AI-GEN] Failed to upload reference image ${i}:`, e);
                }
            }
        }

        // 5. 调用 Gemini 生成纹理 (Call AI)
        // 准备参考图
        const referenceImagesBase64: string[] = [];
        if (referenceImages && Array.isArray(referenceImages)) {
            for (const refImage of referenceImages) {
                const base64 = refImage.startsWith('http') ? await imageUrlToBase64(refImage) : refImage.split(',')[1];
                if (base64) referenceImagesBase64.push(base64);
            }
        }

        // 5. 调用 AI 生成
        // 更新任务状态为处理中
        await supabase.from('generation_tasks').update({ status: 'processing' }).eq('id', taskId);

        const result = await generateWrapTexture({
            modelSlug,
            modelName,
            prompt,
            maskImageBase64: maskImageBase64 || undefined,
            referenceImagesBase64: referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined,
        });

        // 【调试部分】保存所有 AI 参数和提示词到任务文件夹
        try {
            const taskDebugDir = join(process.cwd(), '../../dev-studio/test-previews', taskId);
            if (!existsSync(taskDebugDir)) await mkdir(taskDebugDir, { recursive: true }); // Ensure directory exists
            if (existsSync(taskDebugDir)) {
                const debugParams = {
                    taskId,
                    modelSlug,
                    modelName,
                    userPrompt: prompt,
                    referenceImagesCount: referenceImagesBase64.length,
                    finalPromptSentToAI: result.finalPrompt, // Correctly use result.finalPrompt
                    timestamp: new Date().toLocaleString()
                };
                await writeFile(
                    join(taskDebugDir, 'debug-params.json'),
                    JSON.stringify(debugParams, null, 2)
                );
                console.log(`[AI-DEBUG] Debug params saved to: ${taskDebugDir}/debug-params.json`);
            }
        } catch (debugErr) {
            console.error('[AI-DEBUG] Failed to save debug params:', debugErr);
        }

        // 6. 处理结果
        if (!result.success) {
            // 失败：更新任务状态，理论上这里可以考虑返还积分，或者记录错误供客服处理
            await supabase.from('generation_tasks')
                .update({ status: 'failed', error_message: result.error, updated_at: new Date().toISOString() })
                .eq('id', taskId);

            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

        // 7. 成功：记录结果并返回
        // 在开发模式下，也将图片保存到本地文件系统以便历史预览
        if (!result.dataUrl) {
            return NextResponse.json({ success: false, error: 'AI generated image but no data returned' }, { status: 500 });
        }

        let savedUrl = result.dataUrl;
        let correctedDataUrl = result.dataUrl;

        try {
            const filename = `wrap-${taskId.substring(0, 8)}-${Date.now()}.png`;
            const sharp = (await import('sharp')).default;

            const base64Data = result.dataUrl.replace(/^data:image\/\w+;base64,/, '');
            let buffer = Buffer.from(base64Data, 'base64');

            const metadata = await sharp(buffer).metadata();
            const rawWidth = metadata.width || 0;
            const rawHeight = metadata.height || 0;
            console.log(`[AI-DEBUG] AI raw output dimensions: ${rawWidth}x${rawHeight}`);

            // 【调试部分】保存 AI 生成的原始图到任务文件夹
            try {
                const taskDebugDir = join(process.cwd(), '../../dev-studio/test-previews', taskId);
                if (existsSync(taskDebugDir)) {
                    const rawPath = join(taskDebugDir, 'raw-output.png');
                    await writeFile(rawPath, buffer);

                    // 同时更新 debug-params.json 记录尺寸
                    const debugParamsPath = join(taskDebugDir, 'debug-params.json');
                    if (existsSync(debugParamsPath)) {
                        const params = JSON.parse(await readFile(debugParamsPath, 'utf8'));
                        params.aiOutputDimensions = `${rawWidth}x${rawHeight}`;
                        await writeFile(debugParamsPath, JSON.stringify(params, null, 2));
                    }
                    console.log(`[AI-DEBUG] Raw AI output saved and dimensions logged.`);
                }
            } catch (debugErr) {
                console.error('[AI-DEBUG] Failed to save raw debug info:', debugErr);
            }

            // 1. 获取 Mask 的尺寸作为目标尺寸
            const maskDimensions = getMaskDimensions(currentModelSlug);
            const targetWidth = maskDimensions.width;
            const targetHeight = maskDimensions.height;

            // 2. 执行纠偏和校正
            let pipe = sharp(buffer);

            // 首先调整到 Mask 的原始尺寸（解决 AI 输出尺寸微差导致的对齐问题）
            pipe = pipe.resize(targetWidth, targetHeight, { fit: 'fill' });

            // 【重磅修复】重新应用 Mask 以确保黑区（如车顶玻璃）绝对干净，无 AI 溢出
            if (maskImageBase64) {
                const maskBuffer = Buffer.from(maskImageBase64, 'base64');
                // 将黑白 Mask 转换为 Alpha 通道
                const alphaBuffer = await sharp(maskBuffer)
                    .resize(targetWidth, targetHeight)
                    .greyscale()
                    .toBuffer();

                pipe = pipe.joinChannel(alphaBuffer);
            }

            // 3. 执行旋转校正 (将其从 AI 的最优生成角度转回 3D 模型所需的官方角度)
            if (currentModelSlug === 'cybertruck') {
                console.log('[AI-GEN] Output processing: Rotating Cybertruck 90 degrees CW and final resize to 1024x768');
                pipe = pipe.rotate(90);
                // 确保最终尺寸是 1024x768
                pipe = pipe.resize(1024, 768, { fit: 'fill' });
            } else {
                console.log('[AI-GEN] Output processing: Rotating Model 3/Y 180 degrees');
                pipe = pipe.rotate(180);
                // 确保最终尺寸是 1024x1024
                pipe = pipe.resize(1024, 1024, { fit: 'fill' });
            }

            const finalBuffer = await pipe.png().toBuffer();
            correctedDataUrl = `data:image/png;base64,${finalBuffer.toString('base64')}`;

            // 【调试部分】保存旋转后的“最终修正图”到任务文件夹
            try {
                const taskDebugDir = join(process.cwd(), '../../dev-studio/test-previews', taskId);
                if (existsSync(taskDebugDir)) {
                    const finalPath = join(taskDebugDir, 'corrected-final.png');
                    await writeFile(finalPath, finalBuffer);
                    console.log(`[AI-DEBUG] Final corrected image saved to: ${finalPath}`);
                }
            } catch (debugErr) {
                console.error('[AI-DEBUG] Failed to save corrected debug image:', debugErr);
            }

            // 4. 上传到云端 OSS
            try {
                // 恢复使用 'wraps/ai-generated' 子目录，并带上 Content-Type
                savedUrl = await uploadToOSS(finalBuffer, filename, 'wraps/ai-generated');
                console.log('Successfully uploaded corrected wrap to OSS:', savedUrl);
            } catch (ossErr) {
                console.error('OSS Upload failed, falling back to corrected DataURL:', ossErr);
                savedUrl = correctedDataUrl;
            }

        } catch (err) {
            console.error('Error during image correction/upload:', err);
        }

        // 获取用户昵称
        const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .single();

        // 插入到统一的作品表 wraps
        const { data: wrapData, error: historyError } = await supabase.from('wraps').insert({
            user_id: user.id,
            name: (prompt || 'AI生成贴纸').substring(0, 50),
            prompt: prompt,
            model_slug: modelSlug,
            texture_url: savedUrl,
            preview_url: savedUrl,
            is_public: false, // 默认不公开，用户在个人中心手动发布
            category: 'community',
            reference_images: savedReferenceUrls
        }).select('id').single();

        if (historyError) {
            console.error('Failed to save history:', historyError);
            return NextResponse.json({
                success: false,
                error: `Failed to save generation history: ${historyError.message}. Please ensure database schema is up to date.`
            }, { status: 500 });
        }

        const wrapId = wrapData?.id;

        // 更新任务状态为已完成
        await supabase.from('generation_tasks')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', taskId);

        return NextResponse.json({
            success: true,
            taskId,
            wrapId, // 返回真正的作品 ID
            image: {
                dataUrl: correctedDataUrl, // 返回纠正后的 DataUrl 供前端即时渲染
                mimeType: result.mimeType,
                savedUrl: savedUrl
            },
            remainingBalance: deductResult?.[0]?.remaining_balance ?? 0
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
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
