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

        // 角色检查：管理员可用于后台批量刷新他人预览图
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

        const wrapQuery = supabase
            .from('wraps')
            .select('id')
            .eq('id', wrapId);

        if (!isAdmin) {
            wrapQuery.eq('user_id', user.id);
        }

        const { data: wrap, error: wrapError } = await wrapQuery.single();

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
