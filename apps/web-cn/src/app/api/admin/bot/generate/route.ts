/**
 * POST /api/admin/bot/generate
 *
 * 管理员触发 Bot 虚拟账号生成 Wrap。
 * 复用现有 processGenerationTask 链路，任务会出现在 Admin Tasks 面板中，
 * 积分消耗从虚拟账号的 user_credits 扣除（初始充值 9999）。
 *
 * 请求体：
 *   topicId       - bot_topic_candidates.id（优先）
 *   OR
 *   virtualUserId - users.id（bot_creator 角色用户）
 *   modelSlug     - 车型 slug
 *   prompt        - 生成 prompt
 *
 * 鉴权：需要 admin / super_admin 会话。
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { dbQuery, db } from '@/lib/db';
import { getModelBySlug } from '@/config/models';
import { getServiceCost, ServiceType } from '@/lib/constants/credits';
import { processGenerationTask } from '@/app/api/wrap/generate/route';

// Allow up to 300s for async background generation (matches /api/wrap/generate)
export const maxDuration = 300;

const DEFAULT_ORIGIN = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://tewan.club'
).replace(/\/+$/, '');

export async function POST(request: NextRequest) {
    // 1. 鉴权
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
        return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const { topicId } = body;
    let { virtualUserId, modelSlug, prompt } = body as {
        virtualUserId?: string;
        modelSlug?: string;
        prompt?: string;
    };

    // 2. 如果传了 topicId，从数据库读取选题内容
    if (topicId) {
        const { rows: topicRows } = await dbQuery(
            `SELECT * FROM bot_topic_candidates WHERE id = $1 LIMIT 1`,
            [topicId]
        );
        const topic = topicRows[0];

        if (!topic) {
            return NextResponse.json({ success: false, error: 'Topic not found' }, { status: 404 });
        }
        if (topic.status !== 'approved') {
            return NextResponse.json({
                success: false,
                error: `Topic status is '${topic.status}', only 'approved' topics can be generated`
            }, { status: 409 });
        }

        virtualUserId = topic.virtual_user_id || virtualUserId;
        modelSlug = topic.model_slug || modelSlug;
        prompt = topic.suggested_prompt || prompt;
    }

    // 3. 参数校验
    if (!virtualUserId || !modelSlug || !prompt) {
        return NextResponse.json({
            success: false,
            error: 'Missing required fields: virtualUserId, modelSlug, prompt (or topicId)'
        }, { status: 400 });
    }

    // 4. 验证虚拟用户是 bot_creator
    const { rows: userRows } = await dbQuery(
        `SELECT u.id, u.display_name, p.role
         FROM users u
         JOIN profiles p ON p.id = u.id
         WHERE u.id = $1 LIMIT 1`,
        [virtualUserId]
    );
    const botUser = userRows[0];
    if (!botUser) {
        return NextResponse.json({ success: false, error: 'Virtual user not found' }, { status: 404 });
    }
    if (botUser.role !== 'bot_creator') {
        return NextResponse.json({
            success: false,
            error: `User role is '${botUser.role}', expected 'bot_creator'`
        }, { status: 403 });
    }

    // 5. 获取车型名称
    let modelName: string | undefined;
    try {
        const { rows: modelRows } = await dbQuery(
            `SELECT name, name_en FROM wrap_models WHERE slug = $1 AND is_active = true LIMIT 1`,
            [modelSlug]
        );
        if (modelRows[0]) modelName = modelRows[0].name || modelRows[0].name_en;
    } catch { /* ignore */ }
    if (!modelName) {
        modelName = getModelBySlug(modelSlug)?.name;
    }
    if (!modelName) {
        return NextResponse.json({ success: false, error: `Unknown model slug: ${modelSlug}` }, { status: 400 });
    }

    // 6. 扣除积分 + 创建 generation_task（原子事务）
    const creditsToSpend = getServiceCost(ServiceType.AI_GENERATION);
    let taskId: string;
    const client = await db().connect();
    try {
        await client.query('BEGIN');

        // 检查并扣除积分
        const { rows: creditRows } = await client.query(
            `SELECT balance FROM user_credits WHERE user_id = $1 FOR UPDATE`,
            [virtualUserId]
        );
        const balance = Number(creditRows[0]?.balance ?? 0);
        if (balance < creditsToSpend) {
            await client.query('ROLLBACK');
            return NextResponse.json({ success: false, error: `Bot account has insufficient credits (balance: ${balance})` }, { status: 402 });
        }
        await client.query(
            `UPDATE user_credits
             SET balance = balance - $2,
                 total_spent = total_spent + $2,
                 updated_at = NOW()
             WHERE user_id = $1`,
            [virtualUserId, creditsToSpend]
        );

        // 创建任务
        const { rows: taskRows } = await client.query(
            `INSERT INTO generation_tasks
                (user_id, prompt, status, credits_spent, model_slug, created_at, updated_at)
             VALUES ($1, $2, 'pending', $3, $4, NOW(), NOW())
             RETURNING id`,
            [virtualUserId, prompt, creditsToSpend, modelSlug]
        );
        taskId = taskRows[0].id as string;

        // 写入 worker payload（queued_for_worker step）
        const queuedStep = {
            step: 'queued_for_worker',
            ts: new Date().toISOString(),
            modelSlug,
            modelName,
            prompt,
            referenceImages: [],
            origin: DEFAULT_ORIGIN,
        };
        await client.query(
            `UPDATE generation_tasks
             SET steps = COALESCE(steps, '[]'::jsonb) || $2::jsonb,
                 next_retry_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [taskId, JSON.stringify([queuedStep])]
        );

        // 如果传了 topicId，把任务 id 写回选题表并标记为 generating
        if (topicId) {
            await client.query(
                `UPDATE bot_topic_candidates
                 SET status = 'generating', approved_at = COALESCE(approved_at, NOW())
                 WHERE id = $1`,
                [topicId]
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[BOT-GEN] Failed to create task:', err);
        return NextResponse.json({ success: false, error: 'Failed to create generation task' }, { status: 500 });
    } finally {
        client.release();
    }

    console.log(`[BOT-GEN] ✅ Task created: ${taskId} for bot user: ${botUser.display_name} (${virtualUserId})`);

    // 7. 异步触发生成（fire-and-forget），立即返回 202，不阻塞请求
    //    maxDuration = 300 确保 Vercel 给后台足够时间完成 Gemini 调用
    void (async () => {
        try {
            await processGenerationTask({
                taskId,
                userId: virtualUserId!,
                modelSlug: modelSlug!,
                modelName: modelName!,
                prompt: prompt!,
                referenceImages: [],
                origin: DEFAULT_ORIGIN,
            });

            // 生成成功后，更新选题状态为 generated
            if (topicId) {
                const { rows: wrapRows } = await dbQuery(
                    `SELECT id FROM wraps WHERE generation_task_id = $1 LIMIT 1`,
                    [taskId]
                );
                await dbQuery(
                    `UPDATE bot_topic_candidates
                     SET status = 'generated', wrap_id = $2
                     WHERE id = $1`,
                    [topicId, wrapRows[0]?.id || null]
                );
            }

            console.log(`[BOT-GEN] ✅ Generation completed async: taskId=${taskId}`);
        } catch (err: any) {
            console.error('[BOT-GEN] processGenerationTask async error:', err);

            if (topicId) {
                await dbQuery(
                    `UPDATE bot_topic_candidates
                     SET status = 'failed', failure_reason = $2
                     WHERE id = $1`,
                    [topicId, err?.message || 'Unknown error']
                );
            }
        }
    })();

    // 立即返回 202，前端/bot 通过轮询 taskId 状态获知结果
    return NextResponse.json({
        success: true,
        taskId,
        status: 'pending',
        message: `Generation queued for ${botUser.display_name}`,
    }, { status: 202 });
}
