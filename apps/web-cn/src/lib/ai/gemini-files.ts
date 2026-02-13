import { dbQuery } from '../db';

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const GEMINI_API_BASE_URL = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').trim();

export interface GeminiFileResponse {
    file: {
        name: string;
        displayName: string;
        mimeType: string;
        sizeBytes: string;
        createTime: string;
        updateTime: string;
        expirationTime: string;
        sha256Hash: string;
        uri: string;
        state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
    };
}

/**
 * Fetch an asset (Mask or Reference Image) with required Referer to bypass CDN protection.
 */
async function fetchAssetWithReferer(url: string): Promise<Buffer> {
    const referer = 'https://myteslab.com'; // Use the domain allowed in CDN settings
    console.log(`[GEMINI-FILES] Fetching asset with Referer: ${url}`);

    const response = await fetch(url, {
        headers: {
            'Referer': referer,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch asset: ${response.status} ${response.statusText} URL: ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Upload a buffer to Gemini Files API.
 */
async function uploadToGemini(buffer: Buffer, mimeType: string, displayName: string): Promise<GeminiFileResponse> {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

    const url = `${GEMINI_API_BASE_URL}/upload/v1beta/files?key=${GEMINI_API_KEY}`;

    console.log(`[GEMINI-FILES] Uploading to Gemini Files API: ${displayName} (${mimeType}, ${buffer.length} bytes)`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'X-Goog-Upload-Protocol': 'multipart',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            file: { displayName }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini upload initialization failed: ${response.status} ${errText}`);
    }

    // Note: Simple multipart upload for files < 20MB. 
    // For production-grade reliability with multiple parts, we use the standard metadata + data flow.
    // However, Gemini Files API also supports a simpler X-Goog-Upload-Protocol: resumable or multipart.
    // Let's use the most robust single-request multipart for these small images.

    const boundary = '-------' + Math.random().toString(36).substring(2);
    const metadata = JSON.stringify({ file: { displayName } });

    const multipartBody = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
        buffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadResponse = await fetch(url, {
        method: 'POST',
        headers: {
            'X-Goog-Upload-Protocol': 'multipart',
            'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody
    });

    if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Gemini upload data failed: ${uploadResponse.status} ${errText}`);
    }

    return await uploadResponse.json() as GeminiFileResponse;
}

/**
 * Get a valid Gemini File URI for a given external asset URL.
 * Implements caching and auto-refresh (48-hour expiration).
 */
export async function getGeminiFileUri(params: {
    cacheKey: string;     // e.g. 'mask:cybertruck' or the full OSS URL
    assetUrl: string;     // The source URL to fetch if not cached or expired
    mimeType: string;
    displayName: string;
    forceRefresh?: boolean;
}): Promise<string> {
    const { cacheKey, assetUrl, mimeType, displayName, forceRefresh } = params;

    // 1. Check Cache
    if (!forceRefresh) {
        const { rows } = await dbQuery(
            `SELECT file_uri, expires_at 
             FROM gemini_files_cache 
             WHERE cache_key = $1 
             AND expires_at > NOW() + INTERVAL '4 hours' 
             LIMIT 1`,
            [cacheKey]
        );

        if (rows[0]?.file_uri) {
            console.log(`[GEMINI-FILES] Cache hit for ${cacheKey}: ${rows[0].file_uri}`);
            return rows[0].file_uri;
        }
    }

    console.log(`[GEMINI-FILES] Cache miss or expired for ${cacheKey}. Re-uploading...`);

    // 2. Fetch from Source (with Referer)
    const buffer = await fetchAssetWithReferer(assetUrl);

    // 3. Upload to Gemini
    const geminiRes = await uploadToGemini(buffer, mimeType, displayName);
    const fileUri = geminiRes.file.uri;
    const expiresAt = new Date(geminiRes.file.expirationTime);

    // 4. Update Cache
    await dbQuery(
        `INSERT INTO gemini_files_cache (cache_key, file_uri, mime_type, expires_at, uploaded_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (cache_key) DO UPDATE 
         SET file_uri = EXCLUDED.file_uri,
             expires_at = EXCLUDED.expires_at,
             uploaded_at = NOW()`,
        [cacheKey, fileUri, mimeType, expiresAt]
    );

    return fileUri;
}
