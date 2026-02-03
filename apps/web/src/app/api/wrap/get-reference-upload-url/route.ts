import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSignedUrl } from '@/lib/oss';

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png']);

/**
 * POST /api/wrap/get-reference-upload-url
 * Returns a signed OSS PUT URL for client-direct reference image upload
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { contentType, ext } = await request.json();

        if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
            return NextResponse.json({ success: false, error: 'Invalid content type' }, { status: 400 });
        }

        const safeExt = typeof ext === 'string' && ext.length <= 5 ? ext : 'jpg';
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
    } catch (error: any) {
        console.error('[Get-Reference-Upload-Url] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
