import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

type TaskStepRecord = {
    step?: unknown;
    reason?: unknown;
    maskUrl?: unknown;
    assembledPrompt?: unknown;
};

type TaskRow = Record<string, unknown> & {
    steps?: unknown;
    profile_display_name?: string | null;
    profile_email?: string | null;
};

function extractTaskInputArtifacts(steps: unknown): { maskUrl: string | null; assembledPrompt: string | null } {
    if (!Array.isArray(steps)) {
        return { maskUrl: null, assembledPrompt: null };
    }

    let maskUrl: string | null = null;
    let assembledPrompt: string | null = null;

    for (let i = steps.length - 1; i >= 0; i -= 1) {
        const step = steps[i] as TaskStepRecord;
        if (!step || typeof step !== 'object') continue;

        if (!maskUrl && typeof step.maskUrl === 'string' && step.maskUrl.trim()) {
            maskUrl = step.maskUrl.trim();
        }

        if (!assembledPrompt && typeof step.assembledPrompt === 'string' && step.assembledPrompt.trim()) {
            assembledPrompt = step.assembledPrompt.trim();
        }

        // Backward-compatible fallback for old logs written into reason.
        if (!maskUrl && step.step === 'mask_selected' && typeof step.reason === 'string' && step.reason.startsWith('http')) {
            maskUrl = step.reason;
        }
        if (!assembledPrompt && step.step === 'prompt_assembled' && typeof step.reason === 'string' && step.reason.trim()) {
            assembledPrompt = step.reason.trim();
        }

        if (maskUrl && assembledPrompt) break;
    }

    return { maskUrl, assembledPrompt };
}

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

    const { rows } = await dbQuery(
        `SELECT
            t.*,
            p.display_name AS profile_display_name,
            p.email AS profile_email
         FROM generation_tasks t
         LEFT JOIN profiles p ON p.id = t.user_id
         ORDER BY t.created_at DESC
         LIMIT $1`,
        [limit]
    );

    const tasks = rows.map((rawRow) => {
        const row = rawRow as TaskRow;
        const artifacts = extractTaskInputArtifacts(row.steps);
        return {
            ...row,
            mask_url: artifacts.maskUrl,
            assembled_prompt: artifacts.assembledPrompt,
            profiles: row.profile_display_name || row.profile_email ? {
                display_name: row.profile_display_name,
                email: row.profile_email,
            } : null
        };
    });

    return NextResponse.json({ success: true, tasks });
}
