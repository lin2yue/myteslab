import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { pathname, referrer } = body;
        
        if (!pathname) {
            return NextResponse.json({ error: 'Pathname is required' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const userAgent = req.headers.get('user-agent') || 'unknown';
        const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        // 注意：海外版使用 Supabase RPC 或 直接插入，假设 site_analytics 表已存在
        const { error } = await supabase
            .from('site_analytics')
            .insert({
                user_id: user?.id || null,
                pathname,
                referrer: referrer || null,
                user_agent: userAgent,
                ip_address: ipAddress
            });

        if (error) throw error;

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: any) {
        console.error('[Analytics API Error]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
