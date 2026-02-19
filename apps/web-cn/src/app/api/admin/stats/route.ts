import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. 获取基础统计数据
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM profiles) as total_users,
                (SELECT COUNT(*) FROM site_analytics) as total_pv,
                (SELECT COUNT(DISTINCT ip_address) FROM site_analytics) as total_uv,
                (SELECT COUNT(*) FROM site_analytics WHERE created_at > NOW() - INTERVAL '24 hours') as day_pv,
                (SELECT COUNT(DISTINCT ip_address) FROM site_analytics WHERE created_at > NOW() - INTERVAL '24 hours') as day_uv,
                (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '24 hours') as day_registrations
        `;
        const { rows: statsRows } = await dbQuery(statsQuery);

        // 2. 获取最近 7 天的趋势数据
        const trendQuery = `
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as pv,
                COUNT(DISTINCT ip_address) as uv
            FROM site_analytics
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC
        `;
        const { rows: trendRows } = await dbQuery(trendQuery);

        // 3. 热门页面排行榜
        const topPagesQuery = `
            SELECT pathname, COUNT(*) as count
            FROM site_analytics
            GROUP BY pathname
            ORDER BY count DESC
            LIMIT 10
        `;
        const { rows: topPagesRows } = await dbQuery(topPagesQuery);

        return NextResponse.json({
            summary: statsRows[0],
            trends: trendRows,
            topPages: topPagesRows
        });
    } catch (error: any) {
        console.error('[Admin Stats API Error]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
