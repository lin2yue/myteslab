import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
    title: '创作者中心 | 特玩',
    robots: { index: false },
};

interface TrendDay {
    day: string;
    cnt: number;
    credits: number;
}

interface WrapEarning {
    name: string | null;
    download_count: number;
    creator_earnings: number;
    price_credits: number;
}

export default async function CreatorDashboardPage() {
    const user = await getSessionUser();

    if (!user) {
        redirect('/login?next=/creator/dashboard');
    }

    if (user.role !== 'creator') {
        redirect('/');
    }

    const userId = user.id;

    const [
        monthlyRes,
        totalRes,
        wrapsRes,
        trendRes,
        profileRes,
    ] = await Promise.all([
        dbQuery<{ monthly_earning: string }>(
            `SELECT COALESCE(SUM(amount), 0) AS monthly_earning
             FROM credit_ledger
             WHERE user_id = $1
               AND type = 'creator_earning'
               AND created_at >= date_trunc('month', NOW())`,
            [userId]
        ),
        dbQuery<{ total_earning: string }>(
            `SELECT COALESCE(SUM(amount), 0) AS total_earning
             FROM credit_ledger
             WHERE user_id = $1
               AND type = 'creator_earning'`,
            [userId]
        ),
        dbQuery<WrapEarning>(
            `SELECT w.name, w.download_count, w.creator_earnings, w.price_credits
             FROM wraps w
             WHERE w.user_id = $1
               AND w.is_active = true
               AND w.deleted_at IS NULL
             ORDER BY w.creator_earnings DESC
             LIMIT 10`,
            [userId]
        ),
        dbQuery<{ day: string; cnt: string; credits: string }>(
            `SELECT DATE(wp.created_at)::text AS day, COUNT(*)::int AS cnt, COALESCE(SUM(wp.creator_credits_earned), 0)::int AS credits
             FROM wrap_purchases wp
             JOIN wraps w ON w.id = wp.wrap_id
             WHERE w.user_id = $1
               AND wp.created_at > NOW() - INTERVAL '30 days'
             GROUP BY DATE(wp.created_at)
             ORDER BY day`,
            [userId]
        ),
        dbQuery<{ display_name: string | null; avatar_url: string | null }>(
            `SELECT display_name, avatar_url FROM profiles WHERE id = $1 LIMIT 1`,
            [userId]
        ),
    ]);

    const monthlyEarning = Number(monthlyRes.rows[0]?.monthly_earning || 0);
    const totalEarning = Number(totalRes.rows[0]?.total_earning || 0);
    const wraps = wrapsRes.rows;
    const publishedCount = wraps.length;
    const totalDownloads = wraps.reduce((sum, w) => sum + Number(w.download_count || 0), 0);
    const trendData: TrendDay[] = trendRes.rows.map((r) => ({
        day: r.day,
        cnt: Number(r.cnt),
        credits: Number(r.credits),
    }));

    const profile = profileRes.rows[0];
    const avatarSeed = profile?.display_name || user.display_name || 'C';
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarSeed.charAt(0))}&background=random`;

    return (
        <div className="flex flex-col min-h-screen">
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 flex-1 w-full">
                {/* 标题区域 */}
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-200 dark:border-amber-800">
                        <Image
                            src={profile?.avatar_url || defaultAvatar}
                            alt={profile?.display_name || '创作者'}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100">创作者中心</h1>
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">认证创作者</span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
                            {profile?.display_name || user.display_name || user.email || ''}
                        </p>
                    </div>
                </div>

                <DashboardClient
                    monthlyEarning={monthlyEarning}
                    totalEarning={totalEarning}
                    publishedCount={publishedCount}
                    totalDownloads={totalDownloads}
                    trendData={trendData}
                    topWraps={wraps}
                />
            </main>
        </div>
    );
}
