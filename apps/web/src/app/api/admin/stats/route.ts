import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

function toCount(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : 0;
}

function formatDayKey(input: string): string {
    return input.slice(0, 10);
}

export async function GET(_req: NextRequest) {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createAdminClient();
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [
            totalUsersRes,
            totalPvRes,
            dayPvRes,
            dayRegsRes,
            topPagesRes,
            pvTrendRes,
            regTrendRes,
            paymentTrendRes,
            downloadTrendRes,
            totalWrapDownloadsRes,
            totalLedgerRes,
        ] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('site_analytics').select('id', { count: 'exact', head: true }),
            supabase.from('site_analytics').select('id', { count: 'exact', head: true }).gt('created_at', last24h),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).gt('created_at', last24h),
            supabase.from('site_analytics').select('pathname').order('created_at', { ascending: false }).limit(5000),
            supabase.from('site_analytics').select('created_at').gte('created_at', sevenDaysAgo),
            supabase.from('profiles').select('created_at').gte('created_at', sevenDaysAgo),
            supabase.from('credit_ledger').select('created_at, amount, type, user_id').eq('type', 'top-up').gte('created_at', sevenDaysAgo),
            supabase.from('user_downloads').select('downloaded_at').gte('downloaded_at', sevenDaysAgo),
            supabase.from('wraps').select('download_count'),
            supabase.from('credit_ledger').select('amount, type, created_at, user_id').eq('type', 'top-up'),
        ]);

        const totalUsers = toCount(totalUsersRes.count);
        const totalPv = toCount(totalPvRes.count);
        const dayPv = toCount(dayPvRes.count);
        const dayRegs = toCount(dayRegsRes.count);

        // UV in web currently has no reliable distinct aggregation endpoint.
        const totalUv = 'N/A';
        const dayUv = 'N/A';

        const topPagesMap = new Map<string, number>();
        (topPagesRes.data || []).forEach((row: any) => {
            const pathname = String(row.pathname || '/');
            topPagesMap.set(pathname, (topPagesMap.get(pathname) || 0) + 1);
        });
        const topPages = Array.from(topPagesMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([pathname, count]) => ({ pathname, count: String(count) }));

        const dayKeys: string[] = [];
        for (let i = 6; i >= 0; i -= 1) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            dayKeys.push(date.toISOString().slice(0, 10));
        }

        const pvByDay = new Map<string, number>();
        (pvTrendRes.data || []).forEach((row: any) => {
            const key = formatDayKey(String(row.created_at || ''));
            pvByDay.set(key, (pvByDay.get(key) || 0) + 1);
        });

        const regByDay = new Map<string, number>();
        (regTrendRes.data || []).forEach((row: any) => {
            const key = formatDayKey(String(row.created_at || ''));
            regByDay.set(key, (regByDay.get(key) || 0) + 1);
        });

        const paidAmountByDay = new Map<string, number>();
        const payingUsersByDay = new Map<string, Set<string>>();
        (paymentTrendRes.data || []).forEach((row: any) => {
            const key = formatDayKey(String(row.created_at || ''));
            paidAmountByDay.set(key, (paidAmountByDay.get(key) || 0) + Number(row.amount || 0));
            if (!payingUsersByDay.has(key)) {
                payingUsersByDay.set(key, new Set<string>());
            }
            if (row.user_id) {
                payingUsersByDay.get(key)!.add(String(row.user_id));
            }
        });

        const downloadsByDay = new Map<string, number>();
        (downloadTrendRes.data || []).forEach((row: any) => {
            const key = formatDayKey(String(row.downloaded_at || ''));
            downloadsByDay.set(key, (downloadsByDay.get(key) || 0) + 1);
        });

        const trends = dayKeys.map((key) => ({
            date: key,
            pv: String(pvByDay.get(key) || 0),
            uv: '0',
            registrations: String(regByDay.get(key) || 0),
            paid_amount: String(paidAmountByDay.get(key) || 0),
            paying_users: String((payingUsersByDay.get(key) || new Set()).size),
            pay_rate: '0',
            wrap_downloads: String(downloadsByDay.get(key) || 0),
            audio_downloads: '0',
            total_downloads: String(downloadsByDay.get(key) || 0),
        }));

        let totalPaidAmount = 0;
        const totalPayingUsers = new Set<string>();
        let dayPaidAmount = 0;
        const dayPayingUsers = new Set<string>();

        (totalLedgerRes.data || []).forEach((row: any) => {
            const amount = Number(row.amount || 0);
            totalPaidAmount += amount;
            if (row.user_id) totalPayingUsers.add(String(row.user_id));
            const createdAt = String(row.created_at || '');
            if (createdAt > last24h) {
                dayPaidAmount += amount;
                if (row.user_id) dayPayingUsers.add(String(row.user_id));
            }
        });

        const totalWrapDownloads = (totalWrapDownloadsRes.data || []).reduce((sum: number, row: any) => {
            return sum + Number(row.download_count || 0);
        }, 0);

        return NextResponse.json(
            {
                summary: {
                    total_users: String(totalUsers),
                    total_pv: String(totalPv),
                    total_uv: totalUv,
                    day_pv: String(dayPv),
                    day_uv: dayUv,
                    day_registrations: String(dayRegs),
                    total_paying_users: String(totalPayingUsers.size),
                    total_paid_amount: String(totalPaidAmount),
                    day_paying_users: String(dayPayingUsers.size),
                    day_paid_amount: String(dayPaidAmount),
                    total_wrap_downloads: String(totalWrapDownloads),
                    total_audio_downloads: '0',
                    total_downloads: String(totalWrapDownloads),
                    day_wrap_downloads: String(toCount(downloadTrendRes.count)),
                    day_audio_downloads: '0',
                },
                trends,
                topPages,
            },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                },
            }
        );
    } catch (error: any) {
        console.error('[Admin Stats API Error]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
