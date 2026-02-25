import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

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
            geminiRequestAttempt: null,
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
    }

    return {
        maskUrl,
        assembledPrompt,
        geminiRequestPayload,
        geminiRequestModel,
        geminiRequestMode,
        geminiRequestApiUrl,
        geminiRequestAttempt,
    };
}

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get('page') || 1), 1);
    const pageSize = Math.min(Number(searchParams.get('pageSize') || searchParams.get('limit') || 50), 200);
    const offset = (page - 1) * pageSize;

    const supabase = createAdminClient();
    const { data, error, count } = await supabase
        .from('generation_tasks')
        .select(
            `
            id,
            user_id,
            prompt,
            status,
            credits_spent,
            error_message,
            steps,
            created_at,
            updated_at,
            profiles (
                display_name,
                email,
                avatar_url
            )
            `,
            { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const tasks = (data || []).map((row: any) => {
        const artifacts = extractTaskInputArtifacts(row.steps);
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
            ...row,
            mask_url: artifacts.maskUrl,
            assembled_prompt: artifacts.assembledPrompt,
            gemini_request_payload: artifacts.geminiRequestPayload,
            gemini_request_model: artifacts.geminiRequestModel,
            gemini_request_mode: artifacts.geminiRequestMode,
            gemini_request_api_url: artifacts.geminiRequestApiUrl,
            gemini_request_attempt: artifacts.geminiRequestAttempt,
            profiles: profile || null,
        };
    });

    const total = Number(count || 0);
    return NextResponse.json({
        success: true,
        tasks,
        page,
        pageSize,
        total,
        hasMore: offset + tasks.length < total,
    });
}
