import { NextRequest, NextResponse } from 'next/server';
import { verifyInternalRequest } from '@/lib/internal-auth';
import { batchPushUrlsToBaidu, isBaiduPushConfigured } from '@/lib/seo/baidu-push';
import { buildBaiduPushCandidates } from '@/lib/seo/baidu-push-strategy';

export const maxDuration = 300;

const SEO_PUSH_SECRET = (
    process.env.SEO_PUSH_SECRET
    || process.env.WRAP_WORKER_SECRET
    || ''
).trim();
const SEO_PUSH_HMAC_SECRET = (
    process.env.SEO_PUSH_HMAC_SECRET
    || process.env.WRAP_WORKER_HMAC_SECRET
    || ''
).trim();
const SEO_PUSH_ALLOW_LEGACY_TOKEN = (process.env.SEO_PUSH_ALLOW_LEGACY_TOKEN ?? '1').trim() !== '0';
const SEO_PUSH_HMAC_SKEW_SECONDS = Math.max(30, Number(process.env.SEO_PUSH_HMAC_SKEW_SECONDS ?? 300));
const DEFAULT_BATCH_SIZE = Math.max(1, Number(process.env.SEO_PUSH_BATCH_SIZE ?? 100));

type TickBody = {
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
    if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
    return Math.max(1, Math.min(2000, Math.floor(parsed)));
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

function parseBody(rawBody: string): TickBody {
    if (!rawBody.trim()) return {};
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed)) return {};
    return parsed as TickBody;
}

export async function POST(request: NextRequest) {
    if (!SEO_PUSH_SECRET && !SEO_PUSH_HMAC_SECRET) {
        return NextResponse.json(
            { success: false, error: 'Baidu push tick not configured: missing SEO_PUSH_SECRET/SEO_PUSH_HMAC_SECRET' },
            { status: 503 }
        );
    }

    if (!isBaiduPushConfigured()) {
        return NextResponse.json(
            { success: false, error: 'BAIDU_PUSH_TOKEN not configured' },
            { status: 503 }
        );
    }

    const rawBody = await request.text();
    const authed = verifyInternalRequest(request, rawBody, {
        legacySecret: SEO_PUSH_SECRET,
        hmacSecret: SEO_PUSH_HMAC_SECRET,
        allowLegacyToken: SEO_PUSH_ALLOW_LEGACY_TOKEN,
        maxSkewSeconds: SEO_PUSH_HMAC_SKEW_SECONDS
    });

    if (!authed) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body: TickBody;
    try {
        body = parseBody(rawBody);
    } catch (error) {
        return NextResponse.json(
            { success: false, error: `Invalid JSON body: ${toErrorMessage(error)}` },
            { status: 400 }
        );
    }

    try {
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
                pushed: 0,
                candidateTotal: 0,
                strategy: candidates.options,
                sourceBreakdown: candidates.stats
            });
        }

        const batchSize = normalizeBatchSize(body.batchSize);
        const results = await batchPushUrlsToBaidu(candidates.urls, batchSize, {
            source: 'internal_tick'
        });
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
        console.error('[Baidu Push Tick] Error:', message);
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
