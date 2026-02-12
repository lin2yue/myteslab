import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@/lib/oss';
import { getSessionUser } from '@/lib/auth/session';

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png']);
const ALLOWED_EXT_BY_TYPE: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png']
};

function normalizeExt(input: unknown): string {
    if (typeof input !== 'string') return '';
    const value = input.trim().toLowerCase().replace(/^\./, '');
    if (!/^[a-z0-9]{2,5}$/.test(value)) return '';
    return value;
}

/**
 * POST /api/wrap/get-reference-upload-url
 * Returns a signed OSS PUT URL for client-direct reference image upload
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { contentType, ext } = await request.json();

        if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
            return NextResponse.json({ success: false, error: 'Invalid content type' }, { status: 400 });
        }

        const normalizedExt = normalizeExt(ext);
        const allowedExt = ALLOWED_EXT_BY_TYPE[contentType] || [];
        if (normalizedExt && !allowedExt.includes(normalizedExt)) {
            return NextResponse.json({ success: false, error: 'Invalid file extension for content type' }, { status: 400 });
        }

        const safeExt = normalizedExt || allowedExt[0] || 'jpg';
        const filename = `ref-${user.id.substring(0, 8)}-${Date.now()}.${safeExt}`;
        const { url, key } = await getSignedUrl(filename, 'wraps/reference', contentType);

        const cdnBase = (process.env.CDN_DOMAIN || process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club').replace(/\/+$/, '');
        const publicUrl = `${cdnBase}/${key}`;

        return NextResponse.json({
            success: true,
            uploadUrl: url,
            ossKey: key,
            publicUrl
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('[Get-Reference-Upload-Url] Error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
