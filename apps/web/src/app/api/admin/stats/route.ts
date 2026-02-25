import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

const PAGE_SIZE = 1000;
const MAX_SCAN_ROWS = 200000;

type AnalyticsRow = {
    created_at: string | null;
    pathname: string | null;
    ip_address: string | null;
};

type TimeRow = {
    created_at: string | null;
};

type DownloadRow = {
    downloaded_at: string | null;
};

type WrapDownloadCountRow = {
    download_count: number | null;
};

type LedgerRow = {
    created_at: string | null;
    user_id: string | null;
    metadata: Record<string, unknown> | null;
};

type PagedResult<T> = {
    data: T[] | null;
    error: { message: string } | null;
};

function toCount(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : 0;
}

function toDayKey(input: string | null | undefined): string {
    return String(input || '').slice(0, 10);
}

function parsePaidAmount(metadata: unknown): number {
    if (!metadata || typeof metadata !== 'object') return 0;
    const raw = (metadata as Record<string, unknown>).total_amount;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return amount;
}

async function fetchAllRows<T>(
    fetchPage: (from: number, to: number) => Promise<PagedResult<T>>,
    maxRows = MAX_SCAN_ROWS
): Promise<T[]> {
    const rows: T[] = [];
    let from = 0;

    while (rows.length < maxRows) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await fetchPage(from, to);
        if (error) throw new Error(error.message);

        const batch = data || [];
        if (batch.length === 0) break;

        const remain = maxRows - rows.length;
        rows.push(...batch.slice(0, remain));
        if (batch.length < PAGE_SIZE || batch.length > remain) break;
        from += PAGE_SIZE;
    }

    return rows;
}

function buildTrendDayKeys(now: Date): string[] {
    const dayMs = 24 * 60 * 60 * 1000;
    const keys: string[] = [];
    for (let i = 6; i >= 0; i -= 1) {
        keys.push(new Date(now.getTime() - i * dayMs).toISOString().slice(0, 10));
    }
    return keys;
}

export async function GET() {
    try {
        const admin = await requireAdmin();
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createAdminClient();
        const now = new Date();
        const dayMs = 24 * 60 * 60 * 1000;
        const last24hMs = now.getTime() - dayMs;
        const trendStartMs = now.getTime() - 6 * dayMs;
        const last24hIso = new Date(last24hMs).toISOString();
        const trendStartIso = new Date(trendStartMs).toISOString();

        const [totalUsersRes, totalPvRes, dayPvRes, dayRegsRes, dayWrapDownloadsRes, totalWrapDownloadsRes] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('site_analytics').select('id', { count: 'exact', head: true }),
            supabase.from('site_analytics').select('id', { count: 'exact', head: true }).gt('created_at', last24hIso),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).gt('created_at', last24hIso),
            supabase.from('user_downloads').select('user_id', { count: 'exact', head: true }).gt('downloaded_at', last24hIso),
            supabase.from('wraps').select('download_count'),
        ]);

        if (totalUsersRes.error) {
            return NextResponse.json({ error: totalUsersRes.error.message }, { status: 500 });
        }
        if (totalPvRes.error) {
            return NextResponse.json({ error: totalPvRes.error.message }, { status: 500 });
        }
        if (dayPvRes.error) {
            return NextResponse.json({ error: dayPvRes.error.message }, { status: 500 });
        }
        if (dayRegsRes.error) {
            return NextResponse.json({ error: dayRegsRes.error.message }, { status: 500 });
        }
        if (dayWrapDownloadsRes.error) {
            return NextResponse.json({ error: dayWrapDownloadsRes.error.message }, { status: 500 });
        }
        if (totalWrapDownloadsRes.error) {
            return NextResponse.json({ error: totalWrapDownloadsRes.error.message }, { status: 500 });
        }

        const analyticsRows = await fetchAllRows<AnalyticsRow>(async (from, to) => {
            const { data, error } = await supabase
                .from('site_analytics')
                .select('created_at, pathname, ip_address')
                .order('created_at', { ascending: false })
                .range(from, to);
            return {
                data: (data || null) as AnalyticsRow[] | null,
                error: error ? { message: error.message } : null,
            };
        });

        const allTopupRows = await fetchAllRows<LedgerRow>(async (from, to) => {
            const { data, error } = await supabase
                .from('credit_ledger')
                .select('created_at, user_id, metadata')
                .eq('type', 'top-up')
                .order('created_at', { ascending: false })
                .range(from, to);
            return {
                data: (data || null) as LedgerRow[] | null,
                error: error ? { message: error.message } : null,
            };
        });

        const [regTrendRes, wrapTrendRes] = await Promise.all([
            supabase.from('profiles').select('created_at').gte('created_at', trendStartIso),
            supabase.from('user_downloads').select('downloaded_at').gte('downloaded_at', trendStartIso),
        ]);

        if (regTrendRes.error) {
            return NextResponse.json({ error: regTrendRes.error.message }, { status: 500 });
        }
        if (wrapTrendRes.error) {
            return NextResponse.json({ error: wrapTrendRes.error.message }, { status: 500 });
        }

        const [dayAudioRes, audioTrendRes, totalAudioRes] = await Promise.all([
            supabase.from('user_audio_downloads').select('user_id', { count: 'exact', head: true }).gt('downloaded_at', last24hIso),
            supabase.from('user_audio_downloads').select('downloaded_at').gte('downloaded_at', trendStartIso),
            supabase.from('user_audio_downloads').select('user_id', { count: 'exact', head: true }),
        ]);

        const topPagesMap = new Map<string, number>();
        const totalUvSet = new Set<string>();
        const dayUvSet = new Set<string>();
        const pvByDay = new Map<string, number>();
        const uvByDay = new Map<string, Set<string>>();

        analyticsRows.forEach((row) => {
            const pathname = (row.pathname || '/').trim() || '/';
            topPagesMap.set(pathname, (topPagesMap.get(pathname) || 0) + 1);

            const ip = (row.ip_address || '').trim();
            if (ip) totalUvSet.add(ip);

            const createdAtMs = Date.parse(String(row.created_at || ''));
            if (Number.isNaN(createdAtMs)) return;

            if (createdAtMs >= last24hMs && ip) {
                dayUvSet.add(ip);
            }
            if (createdAtMs < trendStartMs) {
                return;
            }

            const dayKey = toDayKey(row.created_at);
            pvByDay.set(dayKey, (pvByDay.get(dayKey) || 0) + 1);

            if (ip) {
                if (!uvByDay.has(dayKey)) {
                    uvByDay.set(dayKey, new Set<string>());
                }
                uvByDay.get(dayKey)!.add(ip);
            }
        });

        const regByDay = new Map<string, number>();
        ((regTrendRes.data || []) as TimeRow[]).forEach((row) => {
            const dayKey = toDayKey(row.created_at);
            regByDay.set(dayKey, (regByDay.get(dayKey) || 0) + 1);
        });

        const wrapDownloadsByDay = new Map<string, number>();
        ((wrapTrendRes.data || []) as DownloadRow[]).forEach((row) => {
            const dayKey = toDayKey(row.downloaded_at);
            wrapDownloadsByDay.set(dayKey, (wrapDownloadsByDay.get(dayKey) || 0) + 1);
        });

        const audioDownloadsByDay = new Map<string, number>();
        if (!audioTrendRes.error) {
            ((audioTrendRes.data || []) as DownloadRow[]).forEach((row) => {
                const dayKey = toDayKey(row.downloaded_at);
                audioDownloadsByDay.set(dayKey, (audioDownloadsByDay.get(dayKey) || 0) + 1);
            });
        }

        let totalPaidAmount = 0;
        let dayPaidAmount = 0;
        const totalPayingUsers = new Set<string>();
        const dayPayingUsers = new Set<string>();
        const paidAmountByDay = new Map<string, number>();
        const payingUsersByDay = new Map<string, Set<string>>();

        allTopupRows.forEach((row) => {
            const paidAmount = parsePaidAmount(row.metadata);
            if (paidAmount <= 0) return;

            const createdAtMs = Date.parse(String(row.created_at || ''));
            if (Number.isNaN(createdAtMs)) return;

            totalPaidAmount += paidAmount;
            if (row.user_id) totalPayingUsers.add(row.user_id);

            if (createdAtMs >= last24hMs) {
                dayPaidAmount += paidAmount;
                if (row.user_id) dayPayingUsers.add(row.user_id);
            }

            if (createdAtMs >= trendStartMs) {
                const dayKey = toDayKey(row.created_at);
                paidAmountByDay.set(dayKey, (paidAmountByDay.get(dayKey) || 0) + paidAmount);

                if (!payingUsersByDay.has(dayKey)) {
                    payingUsersByDay.set(dayKey, new Set<string>());
                }
                if (row.user_id) {
                    payingUsersByDay.get(dayKey)!.add(row.user_id);
                }
            }
        });

        const trendDayKeys = buildTrendDayKeys(now);
        const trends = trendDayKeys.map((dayKey) => {
            const dayUv = (uvByDay.get(dayKey) || new Set<string>()).size;
            const dayPayUsers = (payingUsersByDay.get(dayKey) || new Set<string>()).size;
            const dayPaidAmountValue = Number((paidAmountByDay.get(dayKey) || 0).toFixed(2));
            const wrapDownloads = wrapDownloadsByDay.get(dayKey) || 0;
            const audioDownloads = audioDownloadsByDay.get(dayKey) || 0;

            return {
                date: dayKey,
                pv: String(pvByDay.get(dayKey) || 0),
                uv: String(dayUv),
                registrations: String(regByDay.get(dayKey) || 0),
                paid_amount: String(dayPaidAmountValue),
                paying_users: String(dayPayUsers),
                pay_rate: dayUv > 0 ? ((dayPayUsers / dayUv) * 100).toFixed(2) : '0',
                wrap_downloads: String(wrapDownloads),
                audio_downloads: String(audioDownloads),
                total_downloads: String(wrapDownloads + audioDownloads),
            };
        });

        const topPages = Array.from(topPagesMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([pathname, count]) => ({ pathname, count: String(count) }));

        const totalWrapDownloads = ((totalWrapDownloadsRes.data || []) as WrapDownloadCountRow[]).reduce((sum, row) => {
            return sum + toCount(row.download_count);
        }, 0);

        const totalAudioDownloads = totalAudioRes.error ? 0 : toCount(totalAudioRes.count);
        const dayAudioDownloads = dayAudioRes.error ? 0 : toCount(dayAudioRes.count);
        const dayWrapDownloads = toCount(dayWrapDownloadsRes.count);

        return NextResponse.json(
            {
                summary: {
                    total_users: String(toCount(totalUsersRes.count)),
                    total_pv: String(toCount(totalPvRes.count)),
                    total_uv: String(totalUvSet.size),
                    day_pv: String(toCount(dayPvRes.count)),
                    day_uv: String(dayUvSet.size),
                    day_registrations: String(toCount(dayRegsRes.count)),
                    total_paying_users: String(totalPayingUsers.size),
                    total_paid_amount: String(Number(totalPaidAmount.toFixed(2))),
                    day_paying_users: String(dayPayingUsers.size),
                    day_paid_amount: String(Number(dayPaidAmount.toFixed(2))),
                    total_wrap_downloads: String(totalWrapDownloads),
                    total_audio_downloads: String(totalAudioDownloads),
                    total_downloads: String(totalWrapDownloads + totalAudioDownloads),
                    day_wrap_downloads: String(dayWrapDownloads),
                    day_audio_downloads: String(dayAudioDownloads),
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
    } catch (error: unknown) {
        console.error('[Admin Stats API Error]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
