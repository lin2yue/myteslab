/**
 * 百度搜索引擎 URL 主动推送工具
 * 文档: https://ziyuan.baidu.com/linksubmit/index
 */

interface BaiduPushResponse {
    remain: number;        // 剩余配额
    success: number;       // 成功推送数量
    not_same_site?: string[];  // 非本站 URL
    not_valid?: string[];      // 无效 URL
    error?: number;        // 错误码
    message?: string;      // 错误信息
}

/**
 * 向百度主动推送 URL
 * @param urls 要推送的 URL 列表(最多 2000 个)
 * @returns 推送结果
 */
export async function pushUrlsToBaidu(urls: string | string[]): Promise<BaiduPushResponse | null> {
    const token = process.env.BAIDU_PUSH_TOKEN;
    const site = process.env.BAIDU_PUSH_SITE || 'tewan.club';

    // 开发环境或未配置 token 时跳过
    if (!token) {
        console.log('[Baidu Push] Skipped: BAIDU_PUSH_TOKEN not configured');
        return null;
    }

    // 如果是开发环境,跳过推送
    if (process.env.NODE_ENV === 'development') {
        console.log('[Baidu Push] Skipped: development environment');
        return null;
    }

    try {
        const urlList = Array.isArray(urls) ? urls : [urls];

        // 验证 URL
        const validUrls = urlList.filter(url => {
            try {
                const urlObj = new URL(url);
                return urlObj.hostname.includes(site);
            } catch {
                console.warn(`[Baidu Push] Invalid URL: ${url}`);
                return false;
            }
        });

        if (validUrls.length === 0) {
            console.warn('[Baidu Push] No valid URLs to push');
            return null;
        }

        // 调用百度 API
        const apiUrl = `http://data.zz.baidu.com/urls?site=${site}&token=${token}`;
        const body = validUrls.join('\n');

        console.log(`[Baidu Push] Pushing ${validUrls.length} URL(s) to Baidu...`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body,
        });

        const result: BaiduPushResponse = await response.json();

        if (result.error) {
            console.error(`[Baidu Push] Error ${result.error}: ${result.message}`);
        } else {
            console.log(`[Baidu Push] Success: ${result.success} URLs pushed, ${result.remain} quota remaining`);
        }

        return result;

    } catch (error) {
        console.error('[Baidu Push] Failed:', error);
        return null;
    }
}

/**
 * 推送单个 wrap 详情页
 * @param wrapSlug wrap 的 slug
 */
export async function pushWrapToBaidu(wrapSlug: string): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tewan.club';
    const url = `${baseUrl}/wraps/${wrapSlug}`;

    // 异步推送,不阻塞主流程
    pushUrlsToBaidu(url).catch(err => {
        console.error('[Baidu Push] Async push failed:', err);
    });
}

/**
 * 批量推送多个 URL
 * @param urls URL 列表
 * @param batchSize 每批推送数量(默认 100,最大 2000)
 */
export async function batchPushUrlsToBaidu(urls: string[], batchSize: number = 100): Promise<BaiduPushResponse[]> {
    const results: BaiduPushResponse[] = [];

    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const result = await pushUrlsToBaidu(batch);

        if (result) {
            results.push(result);
        }

        // 避免请求过快,间隔 1 秒
        if (i + batchSize < urls.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return results;
}
