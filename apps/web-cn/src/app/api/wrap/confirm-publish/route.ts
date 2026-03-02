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
        const { wrapId, ossKey, marketplaceOptions } = body as {
            wrapId: string;
            ossKey: string;
            marketplaceOptions?: { enabled: boolean; priceCredits: number };
        };

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

        // 更新权限:
        // - 普通用户: 仅更新自己的 wrap
        // - 管理员: 可跨用户更新，用于后台批量修复预览图
        const isAdmin = user.role === 'admin' || user.role === 'super_admin';
        const priceCredits = marketplaceOptions?.enabled ? (marketplaceOptions.priceCredits ?? 0) : 0;

        const { rows } = isAdmin
            ? await dbQuery(
                `UPDATE wraps
                 SET preview_url = $2, is_public = true, price_credits = $3, updated_at = NOW(),
                     first_published_at = COALESCE(first_published_at, NOW())
                 WHERE id = $1
                 RETURNING *`,
                [wrapId, previewUrl, priceCredits]
            )
            : await dbQuery(
                `UPDATE wraps
                 SET preview_url = $3, is_public = true, price_credits = $4, updated_at = NOW(),
                     first_published_at = COALESCE(first_published_at, NOW())
                 WHERE id = $1 AND user_id = $2
                 RETURNING *`,
                [wrapId, user.id, previewUrl, priceCredits]
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

        // 推送到百度搜索引擎(异步,不阻塞响应)
        const wrap = rows[0];
        if (wrap.slug) {
            const { pushWrapToBaidu } = await import('@/lib/seo/baidu-push');
            pushWrapToBaidu(wrap.slug, { source: 'confirm_publish' }).catch(err => {
                console.error('[Confirm-Publish] Baidu push failed (non-blocking):', err);
            });
        }

        return NextResponse.json({
            success: true,
            previewUrl,
            updatedWrap: rows[0]
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[Confirm-Publish] Global Error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
