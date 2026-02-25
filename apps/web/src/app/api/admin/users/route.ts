import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

type ProfileRow = {
    id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
    created_at: string;
};

type CreditRow = {
    user_id: string;
    balance: number | null;
    gift_balance: number | null;
};

type DownloadRow = {
    user_id: string;
};

type LedgerRow = {
    user_id: string;
    amount: number | null;
};

type QueryError = {
    message: string;
};

function toInt(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : 0;
}

function toFloat(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function chunkArray<T>(input: T[], chunkSize: number): T[][] {
    if (input.length === 0) return [];
    const chunks: T[][] = [];
    for (let i = 0; i < input.length; i += chunkSize) {
        chunks.push(input.slice(i, i + chunkSize));
    }
    return chunks;
}

function isMissingGiftBalanceColumn(error: QueryError | null): boolean {
    if (!error?.message) return false;
    return error.message.toLowerCase().includes('gift_balance');
}

async function fetchAllProfiles(role: string): Promise<ProfileRow[]> {
    const supabase = createAdminClient();
    const pageSize = 1000;
    let from = 0;
    const profiles: ProfileRow[] = [];

    while (true) {
        let query = supabase
            .from('profiles')
            .select('id, email, display_name, avatar_url, role, created_at')
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1);

        if (role !== 'all') {
            query = query.eq('role', role);
        }

        const { data, error } = await query;
        if (error) {
            throw new Error(error.message);
        }

        const rows = (data || []) as ProfileRow[];
        profiles.push(...rows);

        if (rows.length < pageSize) {
            break;
        }
        from += pageSize;
    }

    return profiles;
}

async function fetchCreditsChunk(
    chunkIds: string[],
    hasGiftBalanceColumn: boolean
): Promise<{ rows: CreditRow[]; hasGiftBalanceColumn: boolean; error: QueryError | null }> {
    const supabase = createAdminClient();

    if (hasGiftBalanceColumn) {
        const withGiftRes = await supabase
            .from('user_credits')
            .select('user_id, balance, gift_balance')
            .in('user_id', chunkIds);

        if (!withGiftRes.error) {
            return {
                rows: (withGiftRes.data || []) as CreditRow[],
                hasGiftBalanceColumn: true,
                error: null,
            };
        }

        if (!isMissingGiftBalanceColumn(withGiftRes.error)) {
            return {
                rows: [],
                hasGiftBalanceColumn: true,
                error: { message: withGiftRes.error.message },
            };
        }
    }

    const withoutGiftRes = await supabase
        .from('user_credits')
        .select('user_id, balance')
        .in('user_id', chunkIds);

    if (withoutGiftRes.error) {
        return {
            rows: [],
            hasGiftBalanceColumn: false,
            error: { message: withoutGiftRes.error.message },
        };
    }

    const rows = ((withoutGiftRes.data || []) as Array<{ user_id: string; balance: number | null }>).map((row) => ({
        user_id: row.user_id,
        balance: row.balance,
        gift_balance: 0,
    }));

    return {
        rows,
        hasGiftBalanceColumn: false,
        error: null,
    };
}

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = (searchParams.get('role') || 'all').trim();

    let profiles: ProfileRow[] = [];
    try {
        profiles = await fetchAllProfiles(role);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to query profiles';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }

    const userIds = profiles.map((item) => item.id).filter(Boolean);

    if (userIds.length === 0) {
        return NextResponse.json({ success: true, users: [] });
    }

    const supabase = createAdminClient();
    const creditsRows: CreditRow[] = [];
    const downloadRows: DownloadRow[] = [];
    const topupRows: LedgerRow[] = [];
    const audioRows: DownloadRow[] = [];
    let hasAudioDownloadsTable = true;
    let hasGiftBalanceColumn = true;

    const userIdChunks = chunkArray(userIds, 200);
    for (const chunkIds of userIdChunks) {
        const audioPromise = hasAudioDownloadsTable
            ? supabase.from('user_audio_downloads').select('user_id').in('user_id', chunkIds)
            : Promise.resolve({ data: [], error: null } as { data: DownloadRow[]; error: null });

        const creditsChunkRes = await fetchCreditsChunk(chunkIds, hasGiftBalanceColumn);
        const [downloadsRes, topupsRes, audioRes] = await Promise.all([
            supabase
                .from('user_downloads')
                .select('user_id')
                .in('user_id', chunkIds),
            supabase
                .from('credit_ledger')
                .select('user_id, amount')
                .eq('type', 'top-up')
                .in('user_id', chunkIds),
            audioPromise,
        ]);

        if (creditsChunkRes.error) {
            return NextResponse.json({ success: false, error: creditsChunkRes.error.message }, { status: 500 });
        }
        if (downloadsRes.error) {
            return NextResponse.json({ success: false, error: downloadsRes.error.message }, { status: 500 });
        }
        if (topupsRes.error) {
            return NextResponse.json({ success: false, error: topupsRes.error.message }, { status: 500 });
        }

        hasGiftBalanceColumn = creditsChunkRes.hasGiftBalanceColumn;
        creditsRows.push(...creditsChunkRes.rows);
        downloadRows.push(...((downloadsRes.data || []) as DownloadRow[]));
        topupRows.push(...((topupsRes.data || []) as LedgerRow[]));

        if (audioRes.error) {
            hasAudioDownloadsTable = false;
        } else {
            audioRows.push(...((audioRes.data || []) as DownloadRow[]));
        }
    }

    const creditMap = new Map<string, { balance: number; gift_balance: number }>();
    creditsRows.forEach((row) => {
        creditMap.set(row.user_id, {
            balance: toInt(row.balance),
            gift_balance: toInt(row.gift_balance),
        });
    });

    const wrapDownloadCount = new Map<string, number>();
    downloadRows.forEach((row) => {
        wrapDownloadCount.set(row.user_id, (wrapDownloadCount.get(row.user_id) || 0) + 1);
    });

    const audioDownloadCount = new Map<string, number>();
    audioRows.forEach((row) => {
        audioDownloadCount.set(row.user_id, (audioDownloadCount.get(row.user_id) || 0) + 1);
    });

    const topupMap = new Map<string, number>();
    topupRows.forEach((row) => {
        topupMap.set(row.user_id, (topupMap.get(row.user_id) || 0) + toFloat(row.amount));
    });

    const users = profiles.map((row) => {
        const wrapsDownloadCount = wrapDownloadCount.get(row.id) || 0;
        const audioCount = audioDownloadCount.get(row.id) || 0;
        return {
            ...row,
            email: row.email || '',
            role: (row.role || 'user') as 'user' | 'creator' | 'admin' | 'super_admin',
            wraps_download_count: wrapsDownloadCount,
            audio_download_count: audioCount,
            download_count: wrapsDownloadCount + audioCount,
            total_top_up: topupMap.get(row.id) || 0,
            user_credits: {
                balance: creditMap.get(row.id)?.balance || 0,
                gift_balance: creditMap.get(row.id)?.gift_balance || 0,
            },
        };
    });

    return NextResponse.json({ success: true, users });
}
