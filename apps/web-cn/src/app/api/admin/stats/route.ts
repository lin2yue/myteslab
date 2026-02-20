import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser();
        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { rows: relationRows } = await dbQuery<{ table_name: string | null }>(
            `SELECT to_regclass('public.user_audio_downloads') AS table_name`
        );
        const hasAudioDownloadsTable = Boolean(relationRows[0]?.table_name);
        const dayAudioDownloadsSql = hasAudioDownloadsTable
            ? `(SELECT COUNT(*) FROM user_audio_downloads WHERE downloaded_at > NOW() - INTERVAL '24 hours')`
            : `0`;
        const totalAudioDownloadsSql = hasAudioDownloadsTable
            ? `(SELECT COUNT(*) FROM user_audio_downloads)`
            : `0`;
        const audioDownloadsTrendJoinSql = hasAudioDownloadsTable
            ? `LEFT JOIN (
                    SELECT DATE(downloaded_at) AS date, COUNT(*)::int AS audio_downloads
                    FROM user_audio_downloads
                    WHERE downloaded_at >= current_date - INTERVAL '6 day'
                    GROUP BY DATE(downloaded_at)
                ) ad ON ad.date = d.date`
            : `LEFT JOIN (
                    SELECT NULL::date AS date, 0::int AS audio_downloads
                ) ad ON ad.date = d.date`;

        // 1. 获取基础统计数据
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM profiles) as total_users,
                (SELECT COUNT(*) FROM site_analytics) as total_pv,
                (SELECT COUNT(DISTINCT ip_address) FROM site_analytics) as total_uv,
                (SELECT COUNT(*) FROM site_analytics WHERE created_at > NOW() - INTERVAL '24 hours') as day_pv,
                (SELECT COUNT(DISTINCT ip_address) FROM site_analytics WHERE created_at > NOW() - INTERVAL '24 hours') as day_uv,
                (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '24 hours') as day_registrations,
                (SELECT COUNT(DISTINCT user_id)
                   FROM credit_ledger
                  WHERE type = 'top-up'
                    AND COALESCE(NULLIF(metadata->>'total_amount', ''), '0')::numeric > 0) as total_paying_users,
                (SELECT COALESCE(SUM(COALESCE(NULLIF(metadata->>'total_amount', ''), '0')::numeric), 0)
                   FROM credit_ledger
                  WHERE type = 'top-up') as total_paid_amount,
                (SELECT COUNT(DISTINCT user_id)
                   FROM credit_ledger
                  WHERE type = 'top-up'
                    AND created_at > NOW() - INTERVAL '24 hours'
                    AND COALESCE(NULLIF(metadata->>'total_amount', ''), '0')::numeric > 0) as day_paying_users,
                (SELECT COALESCE(SUM(COALESCE(NULLIF(metadata->>'total_amount', ''), '0')::numeric), 0)
                   FROM credit_ledger
                  WHERE type = 'top-up'
                    AND created_at > NOW() - INTERVAL '24 hours') as day_paid_amount,
                (SELECT COALESCE(SUM(download_count), 0) FROM wraps) as total_wrap_downloads,
                (SELECT COALESCE(SUM(download_count), 0) FROM audios) as total_audio_downloads,
                ((SELECT COALESCE(SUM(download_count), 0) FROM wraps) + (SELECT COALESCE(SUM(download_count), 0) FROM audios)) as total_downloads,
                (SELECT COUNT(*) FROM user_downloads WHERE downloaded_at > NOW() - INTERVAL '24 hours') as day_wrap_downloads,
                ${dayAudioDownloadsSql} as day_audio_downloads
        `;
        const { rows: statsRows } = await dbQuery(statsQuery);

        // 2. 获取最近 7 天的趋势数据
        const trendQuery = `
            WITH d AS (
                SELECT generate_series(current_date - INTERVAL '6 day', current_date, INTERVAL '1 day')::date AS date
            ),
            a AS (
                SELECT
                    DATE(created_at) AS date,
                    COUNT(*)::int AS pv,
                    COUNT(DISTINCT ip_address)::int AS uv
                FROM site_analytics
                WHERE created_at >= current_date - INTERVAL '6 day'
                GROUP BY DATE(created_at)
            ),
            r AS (
                SELECT
                    DATE(created_at) AS date,
                    COUNT(*)::int AS registrations
                FROM profiles
                WHERE created_at >= current_date - INTERVAL '6 day'
                GROUP BY DATE(created_at)
            ),
            p AS (
                SELECT
                    DATE(created_at) AS date,
                    COALESCE(SUM(COALESCE(NULLIF(metadata->>'total_amount', ''), '0')::numeric), 0)::numeric(12,2) AS paid_amount,
                    COUNT(DISTINCT user_id)::int AS paying_users
                FROM credit_ledger
                WHERE type = 'top-up'
                  AND created_at >= current_date - INTERVAL '6 day'
                GROUP BY DATE(created_at)
            ),
            wd AS (
                SELECT
                    DATE(downloaded_at) AS date,
                    COUNT(*)::int AS wrap_downloads
                FROM user_downloads
                WHERE downloaded_at >= current_date - INTERVAL '6 day'
                GROUP BY DATE(downloaded_at)
            )
            SELECT
                TO_CHAR(d.date, 'YYYY-MM-DD') AS date,
                COALESCE(a.pv, 0) AS pv,
                COALESCE(a.uv, 0) AS uv,
                COALESCE(r.registrations, 0) AS registrations,
                COALESCE(p.paid_amount, 0) AS paid_amount,
                COALESCE(p.paying_users, 0) AS paying_users,
                COALESCE(wd.wrap_downloads, 0) AS wrap_downloads,
                COALESCE(ad.audio_downloads, 0) AS audio_downloads,
                COALESCE(wd.wrap_downloads, 0) + COALESCE(ad.audio_downloads, 0) AS total_downloads,
                CASE
                    WHEN COALESCE(a.uv, 0) > 0 THEN ROUND((COALESCE(p.paying_users, 0)::numeric / a.uv::numeric) * 100, 2)
                    ELSE 0
                END AS pay_rate
            FROM d
            LEFT JOIN a ON a.date = d.date
            LEFT JOIN r ON r.date = d.date
            LEFT JOIN p ON p.date = d.date
            LEFT JOIN wd ON wd.date = d.date
            ${audioDownloadsTrendJoinSql}
            ORDER BY d.date ASC
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

        return NextResponse.json(
            {
                summary: statsRows[0],
                trends: trendRows,
                topPages: topPagesRows
            },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
                }
            }
        );
    } catch (error: any) {
        console.error('[Admin Stats API Error]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
