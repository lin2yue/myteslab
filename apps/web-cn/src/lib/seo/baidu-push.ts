/**
 * 百度搜索引擎 URL 主动推送工具
 * 文档: https://ziyuan.baidu.com/linksubmit/index
 */

import { dbQuery } from '@/lib/db';

interface BaiduPushResponse {
    remain: number;        // 剩余配额
    success: number;       // 成功推送数量
    not_same_site?: string[];  // 非本站 URL
    not_valid?: string[];      // 无效 URL
    error?: number;        // 错误码
    message?: string;      // 错误信息
}

const DEFAULT_SITE_HOST = 'tewan.club';
const MAX_URLS_PER_REQUEST = 2000;
const URL_SAMPLE_SIZE = 50;

type BaiduPushStatus = 'success' | 'error' | 'skipped';

export type BaiduPushOptions = {
    source?: string;
};

type BaiduPushLogRecord = {
    source: string;
    siteHost: string;
    requestUrlCount: number;
    requestUrlSample: string[];
    validUrlCount: number;
    status: BaiduPushStatus;
    httpStatus: number | null;
    baiduSuccess: number;
    baiduRemain: number | null;
    baiduError: number | null;
    baiduMessage: string | null;
    notSameSite: string[];
    notValid: string[];
    durationMs: number;
    responsePayload: unknown | null;
};

let ensureLogTablePromise: Promise<void> | null = null;

function normalizeSource(source?: string): string {
    const normalized = (source || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return normalized || 'unknown';
}

async function ensureBaiduPushLogsTable(): Promise<void> {
    if (ensureLogTablePromise) {
        return ensureLogTablePromise;
    }

    ensureLogTablePromise = (async () => {
        await dbQuery(
            `CREATE TABLE IF NOT EXISTS baidu_push_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                source VARCHAR(64) NOT NULL DEFAULT 'unknown',
                site_host TEXT NOT NULL,
                request_url_count INTEGER NOT NULL DEFAULT 0 CHECK (request_url_count >= 0),
                request_url_sample TEXT[] NOT NULL DEFAULT '{}',
                valid_url_count INTEGER NOT NULL DEFAULT 0 CHECK (valid_url_count >= 0),
                status VARCHAR(16) NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
                http_status INTEGER,
                baidu_success INTEGER NOT NULL DEFAULT 0,
                baidu_remain INTEGER,
                baidu_error INTEGER,
                baidu_message TEXT,
                not_same_site TEXT[] NOT NULL DEFAULT '{}',
                not_valid TEXT[] NOT NULL DEFAULT '{}',
                duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
                response_payload JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )`
        );

        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_baidu_push_logs_created_at ON baidu_push_logs(created_at DESC)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_baidu_push_logs_source_created_at ON baidu_push_logs(source, created_at DESC)`);
        await dbQuery(`CREATE INDEX IF NOT EXISTS idx_baidu_push_logs_status_created_at ON baidu_push_logs(status, created_at DESC)`);
    })().catch((error) => {
        ensureLogTablePromise = null;
        throw error;
    });

    return ensureLogTablePromise;
}

async function writeBaiduPushLog(record: BaiduPushLogRecord): Promise<void> {
    try {
        await ensureBaiduPushLogsTable();
        await dbQuery(
            `INSERT INTO baidu_push_logs (
                source,
                site_host,
                request_url_count,
                request_url_sample,
                valid_url_count,
                status,
                http_status,
                baidu_success,
                baidu_remain,
                baidu_error,
                baidu_message,
                not_same_site,
                not_valid,
                duration_ms,
                response_payload
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb
            )`,
            [
                record.source,
                record.siteHost,
                record.requestUrlCount,
                record.requestUrlSample,
                record.validUrlCount,
                record.status,
                record.httpStatus,
                record.baiduSuccess,
                record.baiduRemain,
                record.baiduError,
                record.baiduMessage,
                record.notSameSite,
                record.notValid,
                record.durationMs,
                JSON.stringify(record.responsePayload ?? null)
            ]
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[Baidu Push] Log insert failed: ${message}`);
    }
}

/**
 * 兼容 BAIDU_PUSH_SITE 的两种配置:
 * - tewan.club
 * - https://tewan.club
 */
function normalizeSiteHost(site: string): string {
    const trimmed = site.trim();
    if (!trimmed) return DEFAULT_SITE_HOST;

    try {
        const withProtocol = /^https?:\/\//i.test(trimmed)
            ? trimmed
            : `https://${trimmed}`;
        return new URL(withProtocol).hostname.toLowerCase();
    } catch {
        return trimmed
            .replace(/^https?:\/\//i, '')
            .replace(/\/.*$/, '')
            .toLowerCase();
    }
}

function readPushConfig() {
    const token = (process.env.BAIDU_PUSH_TOKEN || '').trim();
    const site = (process.env.BAIDU_PUSH_SITE || DEFAULT_SITE_HOST).trim() || DEFAULT_SITE_HOST;
    const siteHost = normalizeSiteHost(site);
    return { token, siteHost };
}

export function isBaiduPushConfigured(): boolean {
    return Boolean(readPushConfig().token);
}

/**
 * 向百度主动推送 URL
 * @param urls 要推送的 URL 列表(最多 2000 个)
 * @returns 推送结果
 */
export async function pushUrlsToBaidu(
    urls: string | string[],
    options: BaiduPushOptions = {}
): Promise<BaiduPushResponse | null> {
    const { token, siteHost } = readPushConfig();
    const source = normalizeSource(options.source);
    const startedAt = Date.now();
    const urlList = Array.isArray(urls) ? urls : [urls];
    const dedupedUrls = Array.from(
        new Set(
            urlList
                .map(url => (typeof url === 'string' ? url.trim() : ''))
                .filter(Boolean)
        )
    ).slice(0, MAX_URLS_PER_REQUEST);
    const requestUrlSample = dedupedUrls.slice(0, URL_SAMPLE_SIZE);

    // 验证 URL
    const validUrls = dedupedUrls.filter(url => {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            return hostname === siteHost || hostname.endsWith(`.${siteHost}`);
        } catch {
            console.warn(`[Baidu Push] Invalid URL: ${url}`);
            return false;
        }
    });

    // 开发环境或未配置 token 时跳过
    if (!token) {
        console.log('[Baidu Push] Skipped: BAIDU_PUSH_TOKEN not configured');
        await writeBaiduPushLog({
            source,
            siteHost,
            requestUrlCount: dedupedUrls.length,
            requestUrlSample,
            validUrlCount: validUrls.length,
            status: 'skipped',
            httpStatus: null,
            baiduSuccess: 0,
            baiduRemain: null,
            baiduError: null,
            baiduMessage: 'BAIDU_PUSH_TOKEN not configured',
            notSameSite: [],
            notValid: [],
            durationMs: Date.now() - startedAt,
            responsePayload: null
        });
        return null;
    }

    // 如果是开发环境,跳过推送
    if (process.env.NODE_ENV === 'development') {
        console.log('[Baidu Push] Skipped: development environment');
        await writeBaiduPushLog({
            source,
            siteHost,
            requestUrlCount: dedupedUrls.length,
            requestUrlSample,
            validUrlCount: validUrls.length,
            status: 'skipped',
            httpStatus: null,
            baiduSuccess: 0,
            baiduRemain: null,
            baiduError: null,
            baiduMessage: 'development environment',
            notSameSite: [],
            notValid: [],
            durationMs: Date.now() - startedAt,
            responsePayload: null
        });
        return null;
    }

    if (validUrls.length === 0) {
        console.warn('[Baidu Push] No valid URLs to push');
        await writeBaiduPushLog({
            source,
            siteHost,
            requestUrlCount: dedupedUrls.length,
            requestUrlSample,
            validUrlCount: 0,
            status: 'skipped',
            httpStatus: null,
            baiduSuccess: 0,
            baiduRemain: null,
            baiduError: null,
            baiduMessage: 'No valid URLs to push',
            notSameSite: [],
            notValid: [],
            durationMs: Date.now() - startedAt,
            responsePayload: null
        });
        return null;
    }

    try {
        // 调用百度 API
        // 百度 API 的 site 参数应传纯 host（不带协议）
        const apiUrl = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(siteHost)}&token=${token}`;
        const body = validUrls.join('\n');

        console.log(`[Baidu Push] Pushing ${validUrls.length} URL(s) to Baidu (site=${siteHost})...`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body,
        });

        const rawText = await response.text();
        let result: BaiduPushResponse;
        let responsePayload: unknown = null;
        try {
            result = JSON.parse(rawText) as BaiduPushResponse;
            responsePayload = result;
        } catch {
            result = {
                remain: 0,
                success: 0,
                error: response.status || -1,
                message: `Non-JSON response from Baidu: ${rawText.slice(0, 200)}`
            };
            responsePayload = { rawText: rawText.slice(0, 1000) };
        }

        if (!response.ok && !result.error) {
            result.error = response.status || -1;
            result.message = result.message || `HTTP ${response.status}`;
        }

        if (result.error) {
            console.error(`[Baidu Push] Error ${result.error}: ${result.message}`);
        } else {
            console.log(`[Baidu Push] Success: ${result.success} URLs pushed, ${result.remain} quota remaining`);
        }

        await writeBaiduPushLog({
            source,
            siteHost,
            requestUrlCount: dedupedUrls.length,
            requestUrlSample,
            validUrlCount: validUrls.length,
            status: result.error ? 'error' : 'success',
            httpStatus: response.status || null,
            baiduSuccess: result.success || 0,
            baiduRemain: typeof result.remain === 'number' ? result.remain : null,
            baiduError: typeof result.error === 'number' ? result.error : null,
            baiduMessage: result.message || null,
            notSameSite: result.not_same_site || [],
            notValid: result.not_valid || [],
            durationMs: Date.now() - startedAt,
            responsePayload
        });

        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[Baidu Push] Failed:', error);
        await writeBaiduPushLog({
            source,
            siteHost,
            requestUrlCount: dedupedUrls.length,
            requestUrlSample,
            validUrlCount: validUrls.length,
            status: 'error',
            httpStatus: null,
            baiduSuccess: 0,
            baiduRemain: null,
            baiduError: null,
            baiduMessage: message,
            notSameSite: [],
            notValid: [],
            durationMs: Date.now() - startedAt,
            responsePayload: null
        });
        return null;
    }
}

/**
 * 推送单个 wrap 详情页
 * @param wrapSlug wrap 的 slug
 */
export async function pushWrapToBaidu(
    wrapSlug: string,
    options: BaiduPushOptions = {}
): Promise<void> {
    const safeSlug = encodeURIComponent((wrapSlug || '').trim());
    if (!safeSlug) return;

    const defaultBaseUrl = `https://${normalizeSiteHost(process.env.BAIDU_PUSH_SITE || DEFAULT_SITE_HOST)}`;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || defaultBaseUrl).replace(/\/+$/, '');
    const url = `${baseUrl}/wraps/${safeSlug}`;

    // 异步推送,不阻塞主流程
    pushUrlsToBaidu(url, options).catch(err => {
        console.error('[Baidu Push] Async push failed:', err);
    });
}

/**
 * 批量推送多个 URL
 * @param urls URL 列表
 * @param batchSize 每批推送数量(默认 100,最大 2000)
 */
export async function batchPushUrlsToBaidu(
    urls: string[],
    batchSize: number = 100,
    options: BaiduPushOptions = {}
): Promise<BaiduPushResponse[]> {
    const results: BaiduPushResponse[] = [];
    const normalizedBatchSize = Math.max(1, Math.min(2000, Math.floor(batchSize) || 100));

    for (let i = 0; i < urls.length; i += normalizedBatchSize) {
        const batch = urls.slice(i, i + normalizedBatchSize);
        const result = await pushUrlsToBaidu(batch, options);

        if (result) {
            results.push(result);
        }

        // 避免请求过快,间隔 1 秒
        if (i + normalizedBatchSize < urls.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return results;
}
