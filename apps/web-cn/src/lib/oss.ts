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

    if (!config.accessKeyId || !config.accessKeySecret) {
        throw new Error('OSS credentials missing');
    }

    const client = new OSS(config);
    const ossKey = `${folder}/${filename}`;
    const cdnUrl = process.env.CDN_DOMAIN || process.env.NEXT_PUBLIC_CDN_URL || `https://${config.bucket}.${config.region}.aliyuncs.com`;

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
    folder: string = 'wraps/previews',
    contentType: string = 'image/png'
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
        'Content-Type': contentType,
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
    const options: any = {
        expires: 3600, // 1 hour
        response: {
            'content-disposition': `attachment; filename="${encodeURIComponent(downloadFilename)}"`
        }
    };

    // Extract existing x-oss-process
    let process = '';
    try {
        const urlObj = new URL(url);
        process = urlObj.searchParams.get('x-oss-process') || '';
    } catch (e) {
        // ignore
    }

    // Append our strict requirements: PNG, Resize 1024x1024
    // We add this indiscriminately to ensure the constraints are met.
    // Constraints: PNG, 512-1024px, < 1MB.
    // User Request: Keep resolution at 1024x1024 (Model 3/Y) and 1024x768 (Cybertruck).
    // Strategy: m_lfit,w_1024,h_1024 ensures both 1:1 and 4:3 aspect ratios fit maximally within 1024x1024.
    const strictParams = 'resize,m_lfit,w_1024,h_1024,limit_1/format,png';

    if (process) {
        // Append to existing process (e.g., 'image/rotate,90' -> 'image/rotate,90/resize...')
        options.process = `${process}/${strictParams}`;
    } else {
        // New process
        options.process = `image/${strictParams}`;
    }

    return client.signatureUrl(key, options);
}
