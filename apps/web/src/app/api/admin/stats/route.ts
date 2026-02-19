import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 简化的权限检查 (假设 user.role 存在于 profiles)
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user?.id)
            .single();

        if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 获取基础汇总数据
        const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: totalPV } = await supabase.from('site_analytics').select('*', { count: 'exact', head: true });
        
        // 由于 Supabase 免费版不支持复杂的分组聚合 SQL 统计 24h 内 UV，
        // 建议在海外版使用 RPC 函数或直接查询（此处为演示，执行基础查询）
        
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        const { count: dayPV } = await supabase.from('site_analytics').select('*', { count: 'exact', head: true }).gt('created_at', last24h);
        const { count: dayRegs } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('created_at', last24h);

        // 热门页面 (仅前10)
        const { data: topPages } = await supabase.rpc('get_top_pages', { limit_count: 10 });

        return NextResponse.json({
            summary: {
                total_users: totalUsers,
                total_pv: totalPV,
                total_uv: 'N/A', // 需要 RPC 支持
                day_pv: dayPV,
                day_uv: 'N/A',
                day_registrations: dayRegs
            },
            trends: [], // 需要 RPC 支持
            topPages: topPages || []
        });
    } catch (error: any) {
        console.error('[Admin Stats API Error]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
