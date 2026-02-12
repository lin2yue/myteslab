import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * POST /api/wrap/confirm-publish
 * Finalizes the publication by updating DB metadata and clearing caches
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { wrapId, ossKey } = body;

        if (!wrapId || !ossKey) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        // 构造最终访问 URL
        const bucket = process.env.OSS_BUCKET || 'lock-sounds';
        const region = process.env.OSS_REGION || 'oss-cn-beijing';
        // 优先使用 CDN 域名，否则使用 OSS 原生域名
        const cdnBase = process.env.CDN_DOMAIN || `https://${bucket}.${region}.aliyuncs.com`;
        const previewUrl = `${cdnBase.replace(/\/+$/, '')}/${ossKey}`;

        console.log(`[Confirm-Publish] Finalizing for wrapId: ${wrapId}, previewUrl: ${previewUrl}`);

        // 角色检查：管理员可用于后台批量刷新他人预览图
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

        const updateQuery = supabase
            .from('wraps')
            .update({
                preview_url: previewUrl,
                is_public: true
            })
            .eq('id', wrapId);

        if (!isAdmin) {
            updateQuery.eq('user_id', user.id);
        }

        const { data: updateData, error: updateError } = await updateQuery.select();

        if (updateError) {
            console.error('Failed to update wrap metadata:', updateError);
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        if (!updateData || updateData.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Wrap not found or access denied (ownership check failed)'
            }, { status: 404 });
        }

        // 刷新首页缓存
        try {
            console.log('[Confirm-Publish] Triggering cache revalidation');
            revalidatePath('/', 'layout');
            revalidateTag('wraps', 'default');
        } catch (revalidateErr) {
            console.error('[Confirm-Publish] Cache revalidation error (non-blocking):', revalidateErr);
        }

        return NextResponse.json({
            success: true,
            previewUrl,
            updatedWrap: updateData[0]
        });

    } catch (error: any) {
        console.error('[Confirm-Publish] Global Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
