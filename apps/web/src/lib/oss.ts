/**
 * OSS Client utility (Server-side only)
 */

const getOSSConfig = () => ({
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    bucket: process.env.OSS_BUCKET || 'lock-sounds',
});

/**
 * Upload a buffer to Alibaba Cloud OSS
 * @param buffer The image buffer to upload
 * @param filename The destination filename in OSS
 * @param folder The destination folder (e.g., 'wraps/ai-generated')
 * @returns The public URL of the uploaded file
 */
export async function uploadToOSS(
    buffer: Buffer,
    filename: string,
    folder: string = 'wraps/ai-generated'
): Promise<string> {
    // Avoid top-level require to prevent issues during build/initialization
    const OSS = require('ali-oss');
    const config = getOSSConfig();

    // Debug identifying which keys are missing without exposing them
    console.log('[OSS-DEBUG] Checking env vars:', {
        hasId: !!config.accessKeyId,
        hasSecret: !!config.accessKeySecret,
        region: config.region,
        bucket: config.bucket,
        idLength: config.accessKeyId?.length || 0
    });

    if (!config.accessKeyId || !config.accessKeySecret) {
        throw new Error('OSS credentials missing');
    }

    const client = new OSS(config);
    const ossKey = `${folder}/${filename}`;
    const cdnUrl = process.env.CDN_DOMAIN || `https://${config.bucket}.${config.region}.aliyuncs.com`;

    try {
        await client.put(ossKey, buffer, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000'
            }
        });

        // Return the CDN URL
        const base = cdnUrl.replace(/\/+$/, '');
        return `${base}/${ossKey}`;
    } catch (error) {
        console.error('OSS Upload Error:', error);
        throw error;
    }
}
/**
 * Generate a signed PUT URL for client-side direct upload
 */
export async function getSignedUrl(
    filename: string,
    folder: string = 'wraps/previews'
): Promise<{ url: string; key: string }> {
    const OSS = require('ali-oss');
    const config = getOSSConfig();
    const client = new OSS({
        ...config,
        secure: true // 强制使用 HTTPS
    });

    if (!config.accessKeyId || !config.accessKeySecret) {
        throw new Error('OSS credentials missing');
    }

    const ossKey = `${folder}/${filename}`;

    // 生成 2 分钟有效的 PUT 签名连接
    const url = client.signatureUrl(ossKey, {
        method: 'PUT',
        'Content-Type': 'image/png',
        expires: 120
    });

    return { url, key: ossKey };
}

/**
 * Generate a signed download URL that forces browser download
 */
export async function getDownloadUrl(
    url: string,
    downloadFilename: string
): Promise<string> {
    const OSS = require('ali-oss');

    // Parse the key from the URL
    let key = '';
    try {
        const urlObj = new URL(url);
        key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
    } catch (e) {
        // Fallback for relative paths
        key = url.startsWith('/') ? url.substring(1) : url;
    }

    const client = new OSS({
        ...getOSSConfig(),
        secure: true
    });

    // Generate signed URL with response-content-disposition
    return client.signatureUrl(key, {
        expires: 3600, // 1 hour
        response: {
            'content-disposition': `attachment; filename="${encodeURIComponent(downloadFilename)}"`
        }
    });
}
