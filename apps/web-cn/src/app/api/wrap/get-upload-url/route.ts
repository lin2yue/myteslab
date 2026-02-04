import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { getSignedUrl } from '@/lib/oss';

/**
 * GET /api/wrap/get-upload-url
 * Returns a signed OSS PUT URL for client-direct preview upload
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { wrapId } = await request.json();
        if (!wrapId) {
            return NextResponse.json({ success: false, error: 'Missing wrapId' }, { status: 400 });
        }

        // 验证用户是否拥有该作品 (RLS would normally handle this, but explicit check is safer)
        const { rows } = await dbQuery(
            `SELECT id FROM wraps WHERE id = $1 AND user_id = $2 LIMIT 1`,
            [wrapId, user.id]
        );
        if (!rows[0]) {
            return NextResponse.json({ success: false, error: 'Wrap not found or access denied' }, { status: 404 });
        }

        const filename = `preview-${wrapId.substring(0, 8)}-${Date.now()}.png`;
        const { url, key } = await getSignedUrl(filename, 'wraps/previews');

        return NextResponse.json({
            success: true,
            uploadUrl: url,
            ossKey: key
        });

    } catch (error: any) {
        console.error('[Get-Upload-Url] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
