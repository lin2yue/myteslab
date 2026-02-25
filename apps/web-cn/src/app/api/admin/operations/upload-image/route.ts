import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getSignedUrl } from '@/lib/oss';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function sanitizeExtFromType(contentType: string) {
    if (contentType === 'image/png') return 'png';
    if (contentType === 'image/webp') return 'webp';
    return 'jpg';
}

export async function POST(request: NextRequest) {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const rawType = String(body?.contentType || '').trim().toLowerCase();
        const contentType = rawType === 'image/jpg' ? 'image/jpeg' : rawType;

        if (!ALLOWED_TYPES.has(contentType)) {
            return NextResponse.json({ success: false, error: '仅支持 PNG/JPG/WEBP' }, { status: 400 });
        }

        const ext = sanitizeExtFromType(contentType);
        const filename = `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const folder = 'operations/campaigns';
        const { url, key } = await getSignedUrl(filename, folder, contentType);

        const configBucket = process.env.OSS_BUCKET || 'lock-sounds';
        const configRegion = process.env.OSS_REGION || 'oss-cn-beijing';
        const cdnBase = (process.env.CDN_DOMAIN || process.env.NEXT_PUBLIC_CDN_URL || `https://${configBucket}.${configRegion}.aliyuncs.com`).replace(/\/+$/, '');

        return NextResponse.json({
            success: true,
            uploadUrl: url,
            ossKey: key,
            publicUrl: `${cdnBase}/${key}`,
        });
    } catch (error: any) {
        console.error('[admin operations upload-image] error:', error);
        return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 });
    }
}
