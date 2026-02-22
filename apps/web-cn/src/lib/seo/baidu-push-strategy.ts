import { dbQuery } from '@/lib/db';

const DEFAULT_BASE_URL = 'https://tewan.club';
const DEFAULT_HOT_WRAP_LIMIT = 300;
const DEFAULT_LATEST_WRAP_LIMIT = 300;
const DEFAULT_TOP_PAGE_LIMIT = 120;
const DEFAULT_MODEL_LIMIT = 100;
const DEFAULT_MAX_URLS = 1000;
const MAX_URLS_PER_PUSH = 2000;

const CORE_PATHS = [
    '/',
    '/pricing',
    '/faq',
    '/ai-generate/generate',
    '/terms',
    '/privacy'
] as const;

const EXCLUDED_PREFIXES = [
    '/api/',
    '/admin/',
    '/auth/',
    '/profile/',
    '/private/',
    '/debug/',
    '/login/',
    '/checkout/'
] as const;

type SourceKey = 'core' | 'models' | 'hotWraps' | 'latestWraps' | 'topPages';

type WrapSlugRow = {
    slug: string | null;
};

type ModelSlugRow = {
    slug: string | null;
};

type TopPageRow = {
    pathname: string | null;
    pv: number;
};

export type BaiduPushStrategyOptions = {
    baseUrl?: string;
    includeCore?: boolean;
    includeModels?: boolean;
    includeTopPages?: boolean;
    hotWrapLimit?: number;
    latestWrapLimit?: number;
    topPageLimit?: number;
    modelLimit?: number;
    maxUrls?: number;
};

export type BaiduPushStrategyResolvedOptions = {
    baseUrl: string;
    includeCore: boolean;
    includeModels: boolean;
    includeTopPages: boolean;
    hotWrapLimit: number;
    latestWrapLimit: number;
    topPageLimit: number;
    modelLimit: number;
    maxUrls: number;
};

export type BaiduPushCandidateStats = {
    core: number;
    models: number;
    hotWraps: number;
    latestWraps: number;
    topPages: number;
};

export type BaiduPushCandidateResult = {
    urls: string[];
    stats: BaiduPushCandidateStats;
    options: BaiduPushStrategyResolvedOptions;
};

function clampInt(input: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function normalizeBaseUrl(raw: string): string {
    const input = (raw || '').trim() || DEFAULT_BASE_URL;

    try {
        const parsed = new URL(input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`);
        return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
    } catch {
        return DEFAULT_BASE_URL;
    }
}

function normalizePath(pathname: string): string {
    const cleaned = pathname.trim();
    if (!cleaned) return '/';
    if (cleaned === '/') return '/';
    return cleaned.replace(/\/+$/, '') || '/';
}

function isAllowedPublicPath(pathname: string): boolean {
    if (!pathname.startsWith('/')) return false;
    if (pathname === '/') return true;

    if (EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        return false;
    }

    if (CORE_PATHS.includes(pathname as (typeof CORE_PATHS)[number])) {
        return true;
    }

    return /^\/wraps\/[^/]+$/i.test(pathname) || /^\/models\/[^/]+$/i.test(pathname);
}

function normalizeTrackedPathname(raw: string): string | null {
    if (!raw || typeof raw !== 'string') return null;

    try {
        const parsed = new URL(raw, DEFAULT_BASE_URL);
        const normalizedPath = normalizePath(parsed.pathname);
        if (!isAllowedPublicPath(normalizedPath)) return null;
        return normalizedPath;
    } catch {
        return null;
    }
}

function toAbsoluteUrl(baseUrl: string, pathname: string): string {
    if (pathname === '/') return `${baseUrl}/`;
    return `${baseUrl}${pathname}`;
}

export async function buildBaiduPushCandidates(
    input: BaiduPushStrategyOptions = {}
): Promise<BaiduPushCandidateResult> {
    const options: BaiduPushStrategyResolvedOptions = {
        baseUrl: normalizeBaseUrl(input.baseUrl || DEFAULT_BASE_URL),
        includeCore: input.includeCore ?? true,
        includeModels: input.includeModels ?? true,
        includeTopPages: input.includeTopPages ?? true,
        hotWrapLimit: clampInt(input.hotWrapLimit, DEFAULT_HOT_WRAP_LIMIT, 0, MAX_URLS_PER_PUSH),
        latestWrapLimit: clampInt(input.latestWrapLimit, DEFAULT_LATEST_WRAP_LIMIT, 0, MAX_URLS_PER_PUSH),
        topPageLimit: clampInt(input.topPageLimit, DEFAULT_TOP_PAGE_LIMIT, 0, MAX_URLS_PER_PUSH),
        modelLimit: clampInt(input.modelLimit, DEFAULT_MODEL_LIMIT, 0, MAX_URLS_PER_PUSH),
        maxUrls: clampInt(input.maxUrls, DEFAULT_MAX_URLS, 1, MAX_URLS_PER_PUSH)
    };

    const urls = new Set<string>();
    const stats: BaiduPushCandidateStats = {
        core: 0,
        models: 0,
        hotWraps: 0,
        latestWraps: 0,
        topPages: 0
    };

    const addPath = (pathname: string, source: SourceKey) => {
        if (urls.size >= options.maxUrls) return;
        const normalizedPath = normalizePath(pathname);
        if (!isAllowedPublicPath(normalizedPath)) return;
        const absoluteUrl = toAbsoluteUrl(options.baseUrl, normalizedPath);
        if (urls.has(absoluteUrl)) return;
        urls.add(absoluteUrl);
        stats[source] += 1;
    };

    if (options.includeCore) {
        CORE_PATHS.forEach(pathname => addPath(pathname, 'core'));
    }

    if (options.includeModels && options.modelLimit > 0 && urls.size < options.maxUrls) {
        const { rows } = await dbQuery<ModelSlugRow>(
            `SELECT slug
             FROM wrap_models
             WHERE is_active = true
               AND slug IS NOT NULL
             ORDER BY sort_order ASC, created_at ASC
             LIMIT $1`,
            [options.modelLimit]
        );

        rows.forEach(row => {
            if (!row.slug) return;
            addPath(`/models/${encodeURIComponent(row.slug)}`, 'models');
        });
    }

    if (options.hotWrapLimit > 0 && urls.size < options.maxUrls) {
        const { rows } = await dbQuery<WrapSlugRow>(
            `SELECT slug
             FROM wraps
             WHERE is_public = true
               AND is_active = true
               AND slug IS NOT NULL
             ORDER BY COALESCE(user_download_count, download_count, 0) DESC, updated_at DESC, id DESC
             LIMIT $1`,
            [options.hotWrapLimit]
        );

        rows.forEach(row => {
            if (!row.slug) return;
            addPath(`/wraps/${encodeURIComponent(row.slug)}`, 'hotWraps');
        });
    }

    if (options.latestWrapLimit > 0 && urls.size < options.maxUrls) {
        const { rows } = await dbQuery<WrapSlugRow>(
            `SELECT slug
             FROM wraps
             WHERE is_public = true
               AND is_active = true
               AND slug IS NOT NULL
             ORDER BY created_at DESC, id DESC
             LIMIT $1`,
            [options.latestWrapLimit]
        );

        rows.forEach(row => {
            if (!row.slug) return;
            addPath(`/wraps/${encodeURIComponent(row.slug)}`, 'latestWraps');
        });
    }

    if (options.includeTopPages && options.topPageLimit > 0 && urls.size < options.maxUrls) {
        try {
            const { rows } = await dbQuery<TopPageRow>(
                `SELECT pathname, COUNT(*)::int AS pv
                 FROM site_analytics
                 WHERE created_at > NOW() - INTERVAL '30 days'
                   AND pathname IS NOT NULL
                 GROUP BY pathname
                 ORDER BY pv DESC
                 LIMIT $1`,
                [options.topPageLimit]
            );

            rows.forEach(row => {
                if (!row.pathname) return;
                const normalizedPath = normalizeTrackedPathname(row.pathname);
                if (!normalizedPath) return;
                addPath(normalizedPath, 'topPages');
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[Baidu Push Strategy] Skip top pages from analytics: ${message}`);
        }
    }

    return {
        urls: Array.from(urls),
        stats,
        options
    };
}
