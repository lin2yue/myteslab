import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { dbQuery } from '@/lib/db';

const DEFAULT_WINDOW_HOURS = Math.max(1, Number(process.env.WRAP_STATS_WINDOW_HOURS ?? 24));
const MAX_WINDOW_HOURS = Math.max(DEFAULT_WINDOW_HOURS, Number(process.env.WRAP_STATS_MAX_WINDOW_HOURS ?? 24 * 30));
const STALE_SECONDS = Math.max(60, Math.floor(Number(process.env.WRAP_TASK_STALE_MS ?? 10 * 60 * 1000) / 1000));

type SummaryRow = {
    total: number;
    completed: number;
    failed: number;
    failed_refunded: number;
    pending: number;
    processing: number;
};

type DurationRow = {
    p95_seconds: number | null;
    avg_seconds: number | null;
};

type StuckRow = {
    inflight: number;
    stuck: number;
};

function clampWindowHours(input: string | null): number {
    const value = Number(input);
    if (!Number.isFinite(value)) return DEFAULT_WINDOW_HOURS;
    return Math.max(1, Math.min(MAX_WINDOW_HOURS, Math.floor(value)));
}

function toRate(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
    return Number((numerator / denominator).toFixed(4));
}

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const windowHours = clampWindowHours(searchParams.get('hours'));

    const { rows: summaryRows } = await dbQuery<SummaryRow>(
        `SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
            COUNT(*) FILTER (WHERE status = 'failed_refunded')::int AS failed_refunded,
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
            COUNT(*) FILTER (WHERE status = 'processing')::int AS processing
         FROM generation_tasks
         WHERE created_at >= NOW() - ($1::int * INTERVAL '1 hour')`,
        [windowHours]
    );

    const { rows: durationRows } = await dbQuery<DurationRow>(
        `SELECT
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at))) AS p95_seconds,
            AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) AS avg_seconds
         FROM generation_tasks
         WHERE status = 'completed'
           AND started_at IS NOT NULL
           AND finished_at IS NOT NULL
           AND finished_at >= NOW() - ($1::int * INTERVAL '1 hour')`,
        [windowHours]
    );

    const { rows: stuckRows } = await dbQuery<StuckRow>(
        `SELECT
            COUNT(*)::int AS inflight,
            COUNT(*) FILTER (
                WHERE COALESCE(updated_at, created_at) < NOW() - ($1::int * INTERVAL '1 second')
            )::int AS stuck
         FROM generation_tasks
         WHERE status IN ('pending', 'processing')`,
        [STALE_SECONDS]
    );

    const summary = summaryRows[0] || {
        total: 0,
        completed: 0,
        failed: 0,
        failed_refunded: 0,
        pending: 0,
        processing: 0
    };
    const duration = durationRows[0] || { p95_seconds: null, avg_seconds: null };
    const stuck = stuckRows[0] || { inflight: 0, stuck: 0 };

    const terminal = summary.completed + summary.failed + summary.failed_refunded;
    const successRate = toRate(summary.completed, terminal);
    const refundRate = toRate(summary.failed_refunded, terminal);
    const stuckRate = toRate(stuck.stuck, stuck.inflight);

    return NextResponse.json({
        success: true,
        windowHours,
        staleSeconds: STALE_SECONDS,
        counts: {
            total: summary.total,
            completed: summary.completed,
            failed: summary.failed,
            failedRefunded: summary.failed_refunded,
            pending: summary.pending,
            processing: summary.processing,
            terminal,
            inflight: stuck.inflight,
            stuck: stuck.stuck
        },
        rates: {
            successRate,
            refundRate,
            stuckRate
        },
        latency: {
            p95Seconds: Number(duration.p95_seconds ?? 0),
            avgSeconds: Number(duration.avg_seconds ?? 0)
        }
    });
}

