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
};

type DownloadRow = {
    user_id: string;
};

type LedgerRow = {
    user_id: string;
    amount: number | null;
};

function toInt(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : 0;
}

function toFloat(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = (searchParams.get('role') || 'all').trim();

    const supabase = createAdminClient();

    let profilesQuery = supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url, role, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

    if (role !== 'all') {
        profilesQuery = profilesQuery.eq('role', role);
    }

    const { data: profileRows, error: profilesError } = await profilesQuery;
    if (profilesError) {
        return NextResponse.json({ success: false, error: profilesError.message }, { status: 500 });
    }

    const profiles = (profileRows || []) as ProfileRow[];
    const userIds = profiles.map((item) => item.id).filter(Boolean);

    if (userIds.length === 0) {
        return NextResponse.json({ success: true, users: [] });
    }

    const [creditsRes, downloadsRes, topupsRes, audioRes] = await Promise.all([
        supabase
            .from('user_credits')
            .select('user_id, balance')
            .in('user_id', userIds),
        supabase
            .from('user_downloads')
            .select('user_id')
            .in('user_id', userIds),
        supabase
            .from('credit_ledger')
            .select('user_id, amount')
            .eq('type', 'top-up')
            .in('user_id', userIds),
        supabase
            .from('user_audio_downloads')
            .select('user_id')
            .in('user_id', userIds)
    ]);

    const creditsRows = ((creditsRes.data || []) as CreditRow[]);
    const downloadRows = ((downloadsRes.data || []) as DownloadRow[]);
    const topupRows = ((topupsRes.data || []) as LedgerRow[]);

    const creditMap = new Map<string, number>();
    creditsRows.forEach((row) => {
        creditMap.set(row.user_id, toInt(row.balance));
    });

    const wrapDownloadCount = new Map<string, number>();
    downloadRows.forEach((row) => {
        wrapDownloadCount.set(row.user_id, (wrapDownloadCount.get(row.user_id) || 0) + 1);
    });

    const audioDownloadCount = new Map<string, number>();
    if (!audioRes.error) {
        const audioRows = (audioRes.data || []) as DownloadRow[];
        audioRows.forEach((row) => {
            audioDownloadCount.set(row.user_id, (audioDownloadCount.get(row.user_id) || 0) + 1);
        });
    }

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
                balance: creditMap.get(row.id) || 0,
                gift_balance: 0,
            },
        };
    });

    return NextResponse.json({ success: true, users });
}
