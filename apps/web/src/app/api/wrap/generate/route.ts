/**
 * API Route: /api/wrap/generate
 * Handles AI wrap texture generation requests
 */

// Import proxy configuration first
import '@/lib/proxy-config';

import { NextRequest, NextResponse } from 'next/server';
import { generateWrapTexture } from '@/lib/ai/gemini-image';
import { createClient } from '@supabase/supabase-js';
import { imageUrlToBase64 } from '@/lib/ai/gemini-image';

// Model slug to display name mapping
const MODEL_NAMES: Record<string, string> = {
    'cybertruck': 'Cybertruck',
    'model-3': 'Model 3',
    'model-3-2024-plus': 'Model 3 2024+',
    'model-y-pre-2025': 'Model Y',
    'model-y-2025-plus': 'Model Y 2025+',
};

// Mask image URLs
// Now using the current origin to support local development files in public/masks
const getMaskUrl = (modelSlug: string, origin: string): string => {
    // If we have a CDN URL configured, use it (production)
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
    if (cdnUrl && !origin.includes('localhost')) {
        return `${cdnUrl}/masks/${modelSlug}_mask.png`;
    }

    // Otherwise fallback to local public directory (development)
    return `${origin}/masks/${modelSlug}_mask.png`;
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { modelSlug, prompt, referenceImages } = body;


        // Validate required fields
        if (!modelSlug) {
            return NextResponse.json(
                { success: false, error: 'modelSlug is required' },
                { status: 400 }
            );
        }

        if (!prompt) {
            return NextResponse.json(
                { success: false, error: 'prompt is required' },
                { status: 400 }
            );
        }

        const modelName = MODEL_NAMES[modelSlug];
        if (!modelName) {
            return NextResponse.json(
                { success: false, error: `Invalid modelSlug: ${modelSlug}` },
                { status: 400 }
            );
        }

        // Note: Authentication removed as per user request (MVP phase)

        // Initialize Supabase (Anon key for MVP logging attempt)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // 4. Create Task Log (Anonymous) - Best effort logging
        let taskId: string | undefined;
        try {
            const { data: task, error: taskError } = await supabase
                .from('wrap_generation_tasks')
                .insert({
                    // user_id intentionally omitted for anonymous
                    model_slug: modelSlug,
                    prompt: prompt,
                    reference_images: referenceImages || [],
                    status: 'processing'
                })
                .select()
                .single();

            if (task) {
                taskId = task.id;
            } else {
                console.warn('Logging anonymous task failed (likely RLS), proceeding anyway');
            }
        } catch (e) {
            console.warn('Task logging setup failed:', e);
        }

        // 5. Load Mask & Flip 180° before sending to AI (using sharp)
        console.log('Loading and flipping mask for:', modelSlug);

        let maskImageBase64: string | null = null;
        try {
            const sharp = (await import('sharp')).default;

            // Load mask from URL
            const maskUrl = getMaskUrl(modelSlug, request.nextUrl.origin);
            const maskResponse = await fetch(maskUrl);

            if (!maskResponse.ok) {
                throw new Error(`Failed to fetch mask: ${maskResponse.status}`);
            }

            const maskBuffer = Buffer.from(await maskResponse.arrayBuffer());

            // CRITICAL: Flip mask 180° using sharp
            // This makes hood (top) appear at bottom, so AI generates in normal orientation
            // We'll flip the result back in client-side processing
            const flippedMaskBuffer = await sharp(maskBuffer)
                .rotate(180)  // Rotate 180 degrees
                .png()        // Ensure PNG format
                .toBuffer();

            maskImageBase64 = flippedMaskBuffer.toString('base64');

            console.log(`[Wrap Generate] Mask loaded and flipped 180° for ${modelSlug}`);
        } catch (error) {
            console.error('CRITICAL: Failed to load/flip mask image!', error);
            console.warn('Continuing without mask - result may not map correctly to 3D model');
        }

        const referenceImagesBase64: string[] = [];
        if (referenceImages && Array.isArray(referenceImages)) {
            for (const refImage of referenceImages) {
                if (refImage.startsWith('data:')) {
                    const base64 = refImage.split(',')[1];
                    if (base64) referenceImagesBase64.push(base64);
                } else if (refImage.startsWith('http')) {
                    const base64 = await imageUrlToBase64(refImage);
                    if (base64) referenceImagesBase64.push(base64);
                } else {
                    referenceImagesBase64.push(refImage);
                }
            }
        }

        console.log(`Generating wrap for ${modelName} (Anonymous)`);

        // 6. Call AI Generation
        const result = await generateWrapTexture({
            modelSlug,
            modelName,
            prompt,
            maskImageBase64: maskImageBase64 || undefined,
            referenceImagesBase64: referenceImagesBase64.length > 0 ? referenceImagesBase64 : undefined,
        });

        // 7. Handle Result
        if (!result.success) {
            console.error('Generation failed:', result.error);

            // Log failure if possible
            if (taskId) {
                await supabase.from('wrap_generation_tasks')
                    .update({ status: 'failed', error_message: result.error, completed_at: new Date().toISOString() })
                    .eq('id', taskId);
            }

            return NextResponse.json(
                { success: false, error: result.error || '生成失败，请重试' },
                { status: 500 }
            );
        }

        // 8. Log Success (No credit deduction in MVP)
        if (taskId) {
            await supabase.from('wrap_generation_tasks')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', taskId);
        }

        return NextResponse.json({
            success: true,
            modelSlug,
            usage: result.usage,
            image: {
                dataUrl: result.dataUrl,
                mimeType: result.mimeType
            }
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });

    } catch (error) {
        console.error('Error handling wrap generation request:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            }
        );
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
