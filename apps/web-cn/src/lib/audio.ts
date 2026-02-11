const CDN_HOST = 'https://cdn.tewan.club';
const OSS_HOST = 'https://lock-sounds.oss-cn-beijing.aliyuncs.com';

function safeDecode(value: string) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function normalizeUrlForPlayback(url: string): string {
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) return url;

    try {
        const parsed = new URL(url);
        const encodedPath = parsed.pathname
            .split('/')
            .map((segment) => encodeURIComponent(safeDecode(segment)))
            .join('/');

        return `${parsed.origin}${encodedPath}${parsed.search}${parsed.hash}`;
    } catch {
        return url;
    }
}

export function getAudioPlayableUrl(url: string): string {
    if (!url) return '';

    const normalized = normalizeUrlForPlayback(url);
    if (/^data:/i.test(normalized)) {
        return normalized;
    }

    if (!/^https?:\/\//i.test(normalized)) {
        const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
        return `${CDN_HOST}${path}`;
    }

    if (normalized.startsWith(OSS_HOST)) {
        return `${CDN_HOST}${normalized.slice(OSS_HOST.length)}`;
    }

    return normalized;
}

export function getAudioDownloadUrl(url: string, cacheKey = ''): string {
    if (!url) return '';

    const normalized = getAudioPlayableUrl(url);

    let parsed: URL;
    try {
        parsed = new URL(normalized);
    } catch {
        return normalized;
    }

    // 下载走 CDN，保持和小程序一致行为
    if (parsed.origin !== CDN_HOST && parsed.origin !== OSS_HOST) {
        return normalized;
    }

    if (parsed.origin === OSS_HOST) {
        parsed = new URL(`${CDN_HOST}${parsed.pathname}${parsed.search}${parsed.hash}`);
    }

    parsed.searchParams.set('download', '1');
    if (cacheKey) {
        parsed.searchParams.set('v', cacheKey);
    }

    return parsed.toString();
}
