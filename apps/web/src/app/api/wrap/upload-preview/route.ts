import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { uploadToOSS } from '@/lib/oss';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

/**
 * API Route: /api/wrap/upload-preview
 * Handles uploading a 3D preview screenshot for a wrap
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('Auth error in upload-preview:', authError);
            return NextResponse.json({
                success: false,
                error: 'Unauthorized',
                details: authError?.message || 'No user found'
            }, { status: 401 });
        }

        const body = await request.json();
        const { wrapId, imageBase64 } = body;

        console.log(`[Upload-Preview] Processing for wrapId: ${wrapId}, user: ${user.id}`);

        if (!wrapId || !imageBase64) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `preview-${wrapId.substring(0, 8)}-${Date.now()}.png`;

        // 1. 尝试上传到云端 OSS
        let previewUrl = '';
        try {
            previewUrl = await uploadToOSS(buffer, filename, 'wraps/previews');
            console.log('Successfully uploaded preview to OSS:', previewUrl);
        } catch (ossErr: any) {
            console.error('Failed to upload preview to OSS:', ossErr);
            // 这里不再降级到本地，因为我们要以线上数据为主
            return NextResponse.json({
                success: false,
                error: `OSS upload failed: ${ossErr.message || 'Unknown error'}`
            }, { status: 500 });
        }

        // 2. 检查权限策略
        const ADMIN_EMAILS = ['linpengfei', 'admin', 'lin2yue@gmail.com']; // 简单的 Admin 检查，可根据需求扩展 (e.g. env var)
        const userEmail = user.email || '';
        const isAdmin = ADMIN_EMAILS.some(admin => userEmail.includes(admin));

        let updateQuery;

        if (isAdmin && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            // Admin 模式：使用专门的 Admin 客户端 (Service Role)
            const { createAdminClient } = require('@/utils/supabase/admin');
            const adminSupabase = createAdminClient();

            console.log(`[Upload-Preview] Admin override enabled for user ${userEmail}`);
            updateQuery = adminSupabase
                .from('wraps')
                .update({
                    preview_url: previewUrl,
                    is_public: true
                })
                .eq('id', wrapId)
                .select();
        } else {
            // 普通模式或管理员降级模式：若管理员但缺少 Key，则打印警告并降级
            if (isAdmin && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
                console.warn(`[Upload-Preview] Admin ${userEmail} triggered fallback due to missing Service Role Key`);
            }
            // 普通模式：仅允许修改自己的作品
            updateQuery = supabase
                .from('wraps')
                .update({
                    preview_url: previewUrl,
                    is_public: true
                })
                .eq('id', wrapId)
                .eq('user_id', user.id)
                .select();
        }

        const { data: updateData, error: updateError } = await updateQuery;

        if (updateError) {
            console.error('Failed to update wrap preview:', updateError);
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        if (!updateData || updateData.length === 0) {
            console.error(`No wrap found with id ${wrapId} for user ${user.id}`);
            return NextResponse.json({
                success: false,
                error: 'Wrap not found or access denied'
            }, { status: 404 });
        }

        // 3. 强制刷新首页缓存
        try {
            console.log('[Upload-Preview] Triggering cache revalidation for homepage and wraps tag');
            revalidatePath('/', 'layout');
            revalidateTag('wraps');
        } catch (revalidateErr) {
            console.error('[Upload-Preview] Cache revalidation failed (non-blocking):', revalidateErr);
        }

        return NextResponse.json({
            success: true,
            previewUrl,
            updatedWrap: updateData[0]
        });

    } catch (error: any) {
        console.error('Upload preview error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
