import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

type TaskStepRecord = {
    step?: unknown;
    reason?: unknown;
    maskUrl?: unknown;
    assembledPrompt?: unknown;
    requestPayload?: unknown;
    requestModel?: unknown;
    requestMode?: unknown;
    requestApiUrl?: unknown;
    requestAttempt?: unknown;
};

type TaskRow = Record<string, unknown> & {
    steps?: unknown;
    profile_display_name?: string | null;
    profile_email?: string | null;
};

function extractTaskInputArtifacts(steps: unknown): {
    maskUrl: string | null;
    assembledPrompt: string | null;
    geminiRequestPayload: Record<string, unknown> | null;
    geminiRequestModel: string | null;
    geminiRequestMode: string | null;
    geminiRequestApiUrl: string | null;
    geminiRequestAttempt: number | null;
} {
    if (!Array.isArray(steps)) {
        return {
            maskUrl: null,
            assembledPrompt: null,
            geminiRequestPayload: null,
            geminiRequestModel: null,
            geminiRequestMode: null,
            geminiRequestApiUrl: null,
            geminiRequestAttempt: null
        };
    }

    let maskUrl: string | null = null;
    let assembledPrompt: string | null = null;
    let geminiRequestPayload: Record<string, unknown> | null = null;
    let geminiRequestModel: string | null = null;
    let geminiRequestMode: string | null = null;
    let geminiRequestApiUrl: string | null = null;
    let geminiRequestAttempt: number | null = null;

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

        if (!geminiRequestPayload && step.requestPayload && typeof step.requestPayload === 'object' && !Array.isArray(step.requestPayload)) {
            geminiRequestPayload = step.requestPayload as Record<string, unknown>;
        }

        if (!geminiRequestModel && typeof step.requestModel === 'string' && step.requestModel.trim()) {
            geminiRequestModel = step.requestModel.trim();
        }
        if (!geminiRequestMode && typeof step.requestMode === 'string' && step.requestMode.trim()) {
            geminiRequestMode = step.requestMode.trim();
        }
        if (!geminiRequestApiUrl && typeof step.requestApiUrl === 'string' && step.requestApiUrl.trim()) {
            geminiRequestApiUrl = step.requestApiUrl.trim();
        }
        if (!geminiRequestAttempt && typeof step.requestAttempt === 'number' && Number.isFinite(step.requestAttempt)) {
            geminiRequestAttempt = step.requestAttempt;
        }

        if (
            maskUrl
            && assembledPrompt
            && geminiRequestPayload
            && geminiRequestModel
            && geminiRequestMode
            && geminiRequestApiUrl
            && geminiRequestAttempt
        ) break;
    }

    return {
        maskUrl,
        assembledPrompt,
        geminiRequestPayload,
        geminiRequestModel,
        geminiRequestMode,
        geminiRequestApiUrl,
        geminiRequestAttempt
    };
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
            p.email AS profile_email,
            p.avatar_url AS profile_avatar_url
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
            gemini_request_payload: artifacts.geminiRequestPayload,
            gemini_request_model: artifacts.geminiRequestModel,
            gemini_request_mode: artifacts.geminiRequestMode,
            gemini_request_api_url: artifacts.geminiRequestApiUrl,
            gemini_request_attempt: artifacts.geminiRequestAttempt,
            profiles: row.profile_display_name || row.profile_email ? {
                display_name: row.profile_display_name,
                email: row.profile_email,
                avatar_url: row.profile_avatar_url as string | null
            } : null
        };
    });

    return NextResponse.json({ success: true, tasks });
}
