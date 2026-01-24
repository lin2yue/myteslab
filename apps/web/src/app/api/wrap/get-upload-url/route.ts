import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSignedUrl } from '@/lib/oss';

/**
 * GET /api/wrap/get-upload-url
 * Returns a signed OSS PUT URL for client-direct preview upload
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { wrapId } = await request.json();
        if (!wrapId) {
            return NextResponse.json({ success: false, error: 'Missing wrapId' }, { status: 400 });
        }

        // 验证用户是否拥有该作品 (RLS would normally handle this, but explicit check is safer)
        const { data: wrap, error: wrapError } = await supabase
            .from('wraps')
            .select('id')
            .eq('id', wrapId)
            .eq('user_id', user.id)
            .single();

        if (wrapError || !wrap) {
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
