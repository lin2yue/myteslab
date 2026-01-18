const safeDecode = (value) => {
    try {
        return decodeURIComponent(value);
    } catch (err) {
        return value;
    }
};

const normalizeRemoteUrl = (url) => {
    if (!url || typeof url !== 'string') return '';

    if (!/^https?:\/\//i.test(url)) return url;

    let parsed;
    try {
        parsed = new URL(url);
    } catch (err) {
        return url;
    }

    const encodedPath = parsed.pathname
        .split('/')
        .map((segment) => encodeURIComponent(safeDecode(segment)))
        .join('/');

    return `${parsed.origin}${encodedPath}${parsed.search}${parsed.hash}`;
};

const rewriteOssToCdn = (url) => {
    const OSS_HOST = 'https://lock-sounds.oss-cn-beijing.aliyuncs.com';
    const CDN_HOST = 'https://cdn.tewan.club';
    if (!url || typeof url !== 'string') return '';

    if (url.startsWith(OSS_HOST)) {
        return `${CDN_HOST}${url.slice(OSS_HOST.length)}`;
    }

    return url;
};

const getOptimizedImage = (url) => {
    const rewritten = rewriteOssToCdn(url);
    return normalizeRemoteUrl(rewritten);
};

// Test Cases
const urls = [
    'https://cdn.tewan.club/previews/wraps/Model%203-model-3-official-valentine-v1768421630345.png',
    'https://cdn.tewan.club/previews/wraps/Model 3-model-3-official-valentine-v1768421630345.png' // Unencoded space
];

urls.forEach(u => {
    console.log(`Original: ${u}`);
    console.log(`Optimized: ${getOptimizedImage(u)}`);
});
