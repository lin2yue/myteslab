import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

function toNumber(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 100), 200);
    const type = (searchParams.get('type') || 'all').trim();

    const supabase = createAdminClient();

    let logsQuery = supabase
        .from('credit_ledger')
        .select(
            `
            id,
            user_id,
            task_id,
            amount,
            type,
            description,
            metadata,
            created_at,
            profiles (
                display_name,
                email
            )
            `
        )
        .order('created_at', { ascending: false })
        .limit(limit);

    if (type !== 'all') {
        logsQuery = logsQuery.eq('type', type);
    }

    const [{ data: logsRows, error: logsError }, { data: topupRows, error: topupError }] = await Promise.all([
        logsQuery,
        supabase
            .from('credit_ledger')
            .select('user_id, amount, created_at')
            .eq('type', 'top-up')
            .order('created_at', { ascending: false })
            .limit(5000)
    ]);

    if (logsError) {
        return NextResponse.json({ success: false, error: logsError.message }, { status: 500 });
    }

    const logs = (logsRows || []).map((row: any) => ({
        ...row,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] || null : row.profiles || null,
    }));

    let totalTopUpCredits = 0;
    const userAggregate = new Map<string, { total: number; count: number; latest: string }>();

    if (!topupError) {
        (topupRows || []).forEach((row: any) => {
            const userId = row.user_id as string;
            const amount = toNumber(row.amount);
            totalTopUpCredits += amount;
            const current = userAggregate.get(userId);
            if (!current) {
                userAggregate.set(userId, {
                    total: amount,
                    count: 1,
                    latest: row.created_at,
                });
            } else {
                current.total += amount;
                current.count += 1;
                if (new Date(row.created_at).getTime() > new Date(current.latest).getTime()) {
                    current.latest = row.created_at;
                }
                userAggregate.set(userId, current);
            }
        });
    }

    const topUpUsers = Array.from(userAggregate.entries())
        .map(([user_id, value]) => ({
            user_id,
            total_top_up_credits: value.total,
            top_up_count: value.count,
            latest_top_up_at: value.latest,
            profiles: null,
        }))
        .sort((a, b) => b.total_top_up_credits - a.total_top_up_credits)
        .slice(0, 50);

    return NextResponse.json({
        success: true,
        logs,
        topUpSummary: {
            total_top_up_credits: totalTopUpCredits,
            top_up_users: userAggregate.size,
        },
        topUpUsers,
    });
}
