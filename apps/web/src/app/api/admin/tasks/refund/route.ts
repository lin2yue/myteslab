import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

function toInt(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : 0;
}

export async function POST(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const taskId = typeof body?.taskId === 'string' ? body.taskId.trim() : '';
    const reason = typeof body?.reason === 'string' && body.reason.trim()
        ? body.reason.trim()
        : 'Manual admin refund';

    if (!taskId) {
        return NextResponse.json({ success: false, error: 'Missing taskId' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: rpcResult, error: rpcError } = await supabase.rpc('refund_task_credits', {
        p_task_id: taskId,
        p_reason: reason,
    });

    if (!rpcError) {
        const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
        if (!result || result.success !== false) {
            return NextResponse.json({
                success: true,
                refundedCredits: Number(result?.refunded_credits || result?.credits || 0),
                via: 'rpc',
            });
        }
        return NextResponse.json({ success: false, error: result.error_msg || 'Refund failed' }, { status: 400 });
    }

    const { data: task, error: taskError } = await supabase
        .from('generation_tasks')
        .select('id, user_id, credits_spent, status, error_message, steps')
        .eq('id', taskId)
        .maybeSingle();

    if (taskError) {
        return NextResponse.json({ success: false, error: taskError.message }, { status: 500 });
    }

    if (!task) {
        return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    if (task.status === 'failed_refunded') {
        return NextResponse.json({ success: true, alreadyRefunded: true, refundedCredits: 0, via: 'fallback' });
    }

    const refundCredits = Math.max(toInt(task.credits_spent), 0);

    const { data: creditRow, error: creditRowError } = await supabase
        .from('user_credits')
        .select('balance, total_spent')
        .eq('user_id', task.user_id)
        .maybeSingle();

    if (creditRowError) {
        return NextResponse.json({ success: false, error: creditRowError.message }, { status: 500 });
    }

    if (!creditRow) {
        const { error: insertCreditError } = await supabase
            .from('user_credits')
            .insert({
                user_id: task.user_id,
                balance: refundCredits,
                total_earned: refundCredits,
                total_spent: 0,
                updated_at: new Date().toISOString(),
            });

        if (insertCreditError) {
            return NextResponse.json({ success: false, error: insertCreditError.message }, { status: 500 });
        }
    } else {
        const { error: updateCreditError } = await supabase
            .from('user_credits')
            .update({
                balance: toInt(creditRow.balance) + refundCredits,
                total_spent: Math.max(toInt(creditRow.total_spent) - refundCredits, 0),
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', task.user_id);

        if (updateCreditError) {
            return NextResponse.json({ success: false, error: updateCreditError.message }, { status: 500 });
        }
    }

    const { error: insertLedgerError } = await supabase
        .from('credit_ledger')
        .insert({
            user_id: task.user_id,
            task_id: task.id,
            amount: refundCredits,
            type: 'refund',
            description: reason,
            metadata: { admin_id: admin.id, fallback: true },
        });

    if (insertLedgerError) {
        return NextResponse.json({ success: false, error: insertLedgerError.message }, { status: 500 });
    }

    const existingSteps = Array.isArray(task.steps) ? task.steps : [];
    const nextSteps = [...existingSteps, { step: 'refunded', ts: new Date().toISOString(), reason }];

    const { error: updateTaskError } = await supabase
        .from('generation_tasks')
        .update({
            status: 'failed_refunded',
            error_message: task.error_message || reason,
            steps: nextSteps,
            updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

    if (updateTaskError) {
        return NextResponse.json({ success: false, error: updateTaskError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, refundedCredits: refundCredits, via: 'fallback' });
}
