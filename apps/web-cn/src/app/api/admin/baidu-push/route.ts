import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { batchPushUrlsToBaidu, isBaiduPushConfigured } from '@/lib/seo/baidu-push';
import { buildBaiduPushCandidates } from '@/lib/seo/baidu-push-strategy';

type PushBody = {
    includeCore?: boolean;
    includeModels?: boolean;
    includeTopPages?: boolean;
    hotLimit?: number;
    latestLimit?: number;
    topPageLimit?: number;
    modelLimit?: number;
    maxUrls?: number;
    batchSize?: number;
};

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeBatchSize(input: unknown): number {
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return 100;
    return Math.max(1, Math.min(2000, Math.floor(parsed)));
}

async function parseBody(request: NextRequest): Promise<PushBody> {
    const raw = await request.text();
    if (!raw.trim()) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return parsed as PushBody;
}

function getBaseUrl(): string {
    const raw = (
        process.env.NEXT_PUBLIC_APP_URL
        || process.env.NEXT_PUBLIC_SITE_URL
        || 'https://tewan.club'
    ).trim();

    if (!raw) return 'https://tewan.club';

    try {
        const parsed = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
        return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
    } catch {
        return 'https://tewan.club';
    }
}

/**
 * POST /api/admin/baidu-push
 * 策略化批量推送 URL 到百度:
 * - 核心页面
 * - 热门作品页(按下载热度)
 * - 最新作品页
 * - 车型页
 * - 热门访问页(来自站内 analytics)
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser();
        const isAdmin = Boolean(
            user && (
                user.role === 'admin'
                || user.role === 'super_admin'
                || user.email === 'lin2yue@gmail.com'
            )
        );

        if (!isAdmin) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 403 }
            );
        }

        let body: PushBody;
        try {
            body = await parseBody(request);
        } catch (error) {
            return NextResponse.json(
                { success: false, error: `Invalid JSON body: ${toErrorMessage(error)}` },
                { status: 400 }
            );
        }

        const candidates = await buildBaiduPushCandidates({
            baseUrl: getBaseUrl(),
            includeCore: body.includeCore,
            includeModels: body.includeModels,
            includeTopPages: body.includeTopPages,
            hotWrapLimit: body.hotLimit,
            latestWrapLimit: body.latestLimit,
            topPageLimit: body.topPageLimit,
            modelLimit: body.modelLimit,
            maxUrls: body.maxUrls
        });

        if (candidates.urls.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No eligible URLs to push',
                candidateTotal: 0,
                strategy: candidates.options,
                sourceBreakdown: candidates.stats
            });
        }

        if (!isBaiduPushConfigured()) {
            return NextResponse.json(
                {
                    success: false,
                    skipped: true,
                    error: 'BAIDU_PUSH_TOKEN not configured',
                    candidateTotal: candidates.urls.length,
                    strategy: candidates.options,
                    sourceBreakdown: candidates.stats
                },
                { status: 503 }
            );
        }

        const batchSize = normalizeBatchSize(body.batchSize);
        console.log(
            `[Baidu Batch Push] Start: candidates=${candidates.urls.length}, batchSize=${batchSize}`
        );

        const results = await batchPushUrlsToBaidu(candidates.urls, batchSize, {
            source: 'admin_batch'
        });
        if (results.length === 0) {
            return NextResponse.json({
                success: true,
                skipped: true,
                message: process.env.NODE_ENV === 'development'
                    ? 'Skipped in development environment'
                    : 'No push response returned from Baidu',
                candidateTotal: candidates.urls.length,
                strategy: candidates.options,
                sourceBreakdown: candidates.stats
            });
        }

        const totalSuccess = results.reduce((sum, item) => sum + (item.success || 0), 0);
        const totalRemain = results[results.length - 1]?.remain ?? 0;
        const errorBatches = results
            .filter(item => Boolean(item.error))
            .map(item => ({ error: item.error, message: item.message }));

        return NextResponse.json({
            success: true,
            pushed: totalSuccess,
            candidateTotal: candidates.urls.length,
            remain: totalRemain,
            batches: results.length,
            errorBatches,
            strategy: candidates.options,
            sourceBreakdown: candidates.stats
        });
    } catch (error) {
        const message = toErrorMessage(error);
        console.error('[Baidu Batch Push] Error:', message);
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
