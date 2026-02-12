import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';

type TaskHistoryRow = {
    id: string;
    prompt: string;
    status: string;
    error_message: string | null;
    steps: unknown;
    created_at: string;
    updated_at: string;
};

export async function GET(request: Request) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'ai_generated';
    const limit = Math.min(Number(searchParams.get('limit') || 10), 50);

    const { rows } = await dbQuery(
        `SELECT *
         FROM wraps
         WHERE user_id = $1
           AND deleted_at IS NULL
           AND category = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [user.id, category, limit]
    );

    let tasks: TaskHistoryRow[] = [];
    if (category === 'ai_generated') {
        const taskResult = await dbQuery<TaskHistoryRow>(
            `SELECT id, prompt, status, error_message, steps, created_at, updated_at
             FROM generation_tasks
             WHERE user_id = $1
               AND status IN ('pending', 'processing', 'completed', 'failed', 'failed_refunded')
             ORDER BY created_at DESC
             LIMIT $2`,
            [user.id, limit]
        );
        tasks = taskResult.rows;
    }

    return NextResponse.json({ success: true, wraps: rows, tasks });
}
