import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';

/**
 * POST /api/wrap/confirm-publish
 * Finalizes the publication by updating DB metadata and clearing caches
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user) {
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

        // 执行更新 (归一化使用标准 RLS，不再区分管理员)
        const { rows } = await dbQuery(
            `UPDATE wraps
             SET preview_url = $3, is_public = true, updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [wrapId, user.id, previewUrl]
        );

        if (!rows || rows.length === 0) {
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
            updatedWrap: rows[0]
        });

    } catch (error: any) {
        console.error('[Confirm-Publish] Global Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
