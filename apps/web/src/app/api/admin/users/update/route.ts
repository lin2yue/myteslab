import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

const ALLOWED_ROLES = new Set(['user', 'creator', 'admin', 'super_admin']);

function toInt(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : NaN;
}

export async function POST(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const role = typeof body?.role === 'string' ? body.role.trim() : '';
    const balance = toInt(body?.balance);

    if (!userId || !ALLOWED_ROLES.has(role) || Number.isNaN(balance)) {
        return NextResponse.json({ success: false, error: 'Missing or invalid parameters' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { error: roleError } = await supabase
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (roleError) {
        return NextResponse.json({ success: false, error: roleError.message }, { status: 500 });
    }

    const { data: currentCredit, error: currentCreditError } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

    if (currentCreditError) {
        return NextResponse.json({ success: false, error: currentCreditError.message }, { status: 500 });
    }

    const oldBalance = Number(currentCredit?.balance || 0);
    const diff = balance - oldBalance;

    if (!currentCredit) {
        const { error: insertCreditError } = await supabase
            .from('user_credits')
            .insert({
                user_id: userId,
                balance,
                total_earned: Math.max(balance, 0),
                total_spent: 0,
                updated_at: new Date().toISOString(),
            });

        if (insertCreditError) {
            return NextResponse.json({ success: false, error: insertCreditError.message }, { status: 500 });
        }
    } else {
        const { error: updateCreditError } = await supabase
            .from('user_credits')
            .update({ balance, updated_at: new Date().toISOString() })
            .eq('user_id', userId);

        if (updateCreditError) {
            return NextResponse.json({ success: false, error: updateCreditError.message }, { status: 500 });
        }
    }

    if (diff !== 0) {
        const { error: ledgerError } = await supabase
            .from('credit_ledger')
            .insert({
                user_id: userId,
                amount: diff,
                type: 'adjustment',
                description: diff > 0 ? `Admin manual gift by ${admin.id}` : `Admin manual reduction by ${admin.id}`,
                metadata: {
                    admin_id: admin.id,
                    old_balance: oldBalance,
                    new_balance: balance,
                },
            });

        if (ledgerError) {
            return NextResponse.json({ success: false, error: ledgerError.message }, { status: 500 });
        }
    }

    return NextResponse.json({ success: true });
}
