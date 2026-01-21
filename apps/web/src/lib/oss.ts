/**
 * OSS Client utility (Server-side only)
 */

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

    const config = {
        region: process.env.OSS_REGION || 'oss-cn-beijing',
        accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
        bucket: process.env.OSS_BUCKET || 'lock-sounds',
    };

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
