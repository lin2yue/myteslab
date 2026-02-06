import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { batchPushUrlsToBaidu } from '@/lib/seo/baidu-push';

/**
 * POST /api/admin/baidu-push
 * 批量推送 wraps 到百度搜索引擎
 * 仅管理员可用
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser();

        // 验证管理员权限
        if (!user || user.email !== 'lin2yue@gmail.com') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { limit = 100, offset = 0 } = body;

        // 获取公开的 wraps
        const { rows } = await dbQuery(
            `SELECT slug FROM wraps 
       WHERE is_public = true AND slug IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        if (!rows || rows.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No wraps to push',
                pushed: 0,
            });
        }

        // 构建 URLs
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tewan.club';
        const urls = rows.map((row: any) => `${baseUrl}/wraps/${row.slug}`);

        console.log(`[Baidu Batch Push] Pushing ${urls.length} URLs...`);

        // 批量推送
        const results = await batchPushUrlsToBaidu(urls, 100);

        // 统计结果
        const totalSuccess = results.reduce((sum, r) => sum + (r.success || 0), 0);
        const totalRemain = results.length > 0 ? results[results.length - 1].remain : 0;

        return NextResponse.json({
            success: true,
            pushed: totalSuccess,
            total: urls.length,
            remain: totalRemain,
            batches: results.length,
        });

    } catch (error: any) {
        console.error('[Baidu Batch Push] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
