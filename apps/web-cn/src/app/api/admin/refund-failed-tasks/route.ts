import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';

/**
 * POST /api/admin/refund-failed-tasks
 * 查询并退款失败的任务
 * 仅管理员可用
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getSessionUser();

        // 验证管理员权限
        if (!user || user.email !== 'lin2yue@gmail.com') {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { userId, taskIds, autoRefund = false } = body;

        const client = await db().connect();

        try {
            // 查询失败的任务
            let query = `
        SELECT 
          gt.id,
          gt.user_id,
          gt.prompt,
          gt.status,
          gt.credits_spent,
          gt.error_message,
          gt.created_at,
          u.email
        FROM generation_tasks gt
        LEFT JOIN users u ON gt.user_id = u.id
        WHERE gt.status IN ('failed', 'processing')
      `;

            const params: any[] = [];

            if (userId) {
                query += ` AND gt.user_id = $1`;
                params.push(userId);
            }

            if (taskIds && Array.isArray(taskIds)) {
                const placeholder = params.length + 1;
                query += ` AND gt.id = ANY($${placeholder})`;
                params.push(taskIds);
            }

            query += ` ORDER BY gt.created_at DESC LIMIT 50`;

            const { rows: tasks } = await client.query(query, params);

            // 如果不是自动退款,只返回列表
            if (!autoRefund) {
                return NextResponse.json({
                    success: true,
                    tasks: tasks.map(t => ({
                        id: t.id,
                        userId: t.user_id,
                        email: t.email,
                        prompt: t.prompt?.substring(0, 100),
                        status: t.status,
                        creditsSpent: t.credits_spent,
                        errorMessage: t.error_message,
                        createdAt: t.created_at,
                    })),
                });
            }

            // 执行退款
            const refundResults = [];

            for (const task of tasks) {
                try {
                    await client.query('BEGIN');

                    // 检查是否已退款
                    if (task.status === 'failed_refunded') {
                        refundResults.push({
                            taskId: task.id,
                            success: true,
                            alreadyRefunded: true,
                        });
                        await client.query('COMMIT');
                        continue;
                    }

                    const credits = Number(task.credits_spent || 0);
                    const taskUserId = task.user_id as string;

                    const { rows: chargeRows } = await client.query(
                        `SELECT amount
                         FROM credit_ledger
                         WHERE task_id = $1
                           AND type IN ('generation', 'generation_charge')
                         ORDER BY created_at ASC
                         LIMIT 1`,
                        [task.id]
                    );
                    const refundableCredits = chargeRows[0]
                        ? Math.abs(Number(chargeRows[0].amount || credits))
                        : 0;

                    // 更新用户积分（仅在该任务已实际扣费时）
                    if (refundableCredits > 0) {
                        await client.query(
                            `UPDATE user_credits
                             SET balance = balance + $2,
                                 total_spent = GREATEST(total_spent - $2, 0),
                                 updated_at = NOW()
                             WHERE user_id = $1`,
                            [taskUserId, refundableCredits]
                        );
                    }

                    // 记录退款
                    await client.query(
                        `INSERT INTO credit_ledger (user_id, task_id, amount, type, description, created_at)
             VALUES ($1, $2, $3, 'refund', $4, NOW())`,
                        [
                            taskUserId,
                            task.id,
                            refundableCredits,
                            refundableCredits > 0
                                ? `Admin refund: ${task.error_message || 'Database error'}`
                                : `Admin mark refunded without charge: ${task.error_message || 'No charge ledger'}`
                        ]
                    );

                    // 更新任务状态
                    await client.query(
                        `UPDATE generation_tasks
             SET status = 'failed_refunded',
                 error_message = COALESCE(error_message, 'Refunded by admin'),
                 updated_at = NOW()
             WHERE id = $1`,
                        [task.id]
                    );

                    await client.query('COMMIT');

                    refundResults.push({
                        taskId: task.id,
                        success: true,
                        creditsRefunded: refundableCredits,
                    });

                } catch (err) {
                    await client.query('ROLLBACK');
                    refundResults.push({
                        taskId: task.id,
                        success: false,
                        error: err instanceof Error ? err.message : 'Unknown error',
                    });
                }
            }

            return NextResponse.json({
                success: true,
                refunded: refundResults.filter(r => r.success).length,
                failed: refundResults.filter(r => !r.success).length,
                results: refundResults,
            });

        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('[Admin Refund] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
