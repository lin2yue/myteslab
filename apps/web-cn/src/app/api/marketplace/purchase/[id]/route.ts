import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db, dbQuery } from '@/lib/db';

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: wrapId } = await params;
        const user = await getSessionUser();

        if (!user) {
            return NextResponse.json({ error: '请登录后操作' }, { status: 401 });
        }

        // 获取 wrap 信息
        const { rows: wrapRows } = await dbQuery(
            `SELECT id, user_id, price_credits, is_public, is_active, deleted_at
             FROM wraps WHERE id = $1 LIMIT 1`,
            [wrapId]
        );
        const wrap = wrapRows[0];

        if (!wrap || wrap.deleted_at || !wrap.is_active || !wrap.is_public) {
            return NextResponse.json({ error: '贴图不存在或不可购买' }, { status: 404 });
        }

        const priceCredits = Number(wrap.price_credits || 0);
        if (priceCredits <= 0) {
            return NextResponse.json({ error: '该贴图为免费下载' }, { status: 400 });
        }

        if (user.id === wrap.user_id) {
            return NextResponse.json({ error: '不能购买自己的作品' }, { status: 400 });
        }

        // 检查是否已购买
        const { rows: purchaseRows } = await dbQuery(
            `SELECT id FROM wrap_purchases WHERE buyer_id = $1 AND wrap_id = $2 LIMIT 1`,
            [user.id, wrapId]
        );

        if (purchaseRows.length > 0) {
            const { rows: creditRows } = await dbQuery(
                `SELECT paid_balance FROM user_credits WHERE user_id = $1 LIMIT 1`,
                [user.id]
            );
            return NextResponse.json({
                success: true,
                alreadyPurchased: true,
                remainingPaidBalance: Number(creditRows[0]?.paid_balance || 0)
            });
        }

        // 检查 paid_balance 是否足够
        const { rows: creditRows } = await dbQuery(
            `SELECT paid_balance FROM user_credits WHERE user_id = $1 LIMIT 1`,
            [user.id]
        );
        const userPaidBalance = Number(creditRows[0]?.paid_balance || 0);

        if (userPaidBalance < priceCredits) {
            return NextResponse.json({
                error: '积分不足，付费作品需使用充值积分',
                needCredits: priceCredits,
                hasPaidBalance: userPaidBalance
            }, { status: 402 });
        }

        const creatorShare = Math.floor(priceCredits * 0.7);

        // 事务内完成购买
        const client = await db().connect();
        let committed = false;
        try {
            await client.query('BEGIN');

            // 扣买家 paid_balance 和 balance
            await client.query(
                `UPDATE user_credits
                 SET balance = balance - $2,
                     paid_balance = paid_balance - $2,
                     total_spent = total_spent + $2,
                     updated_at = NOW()
                 WHERE user_id = $1`,
                [user.id, priceCredits]
            );

            // 创作者增加 paid_balance + balance + total_earned
            await client.query(
                `INSERT INTO user_credits (user_id, balance, total_earned, paid_balance, updated_at)
                 VALUES ($1, $2, $2, $2, NOW())
                 ON CONFLICT (user_id)
                 DO UPDATE SET
                    balance = user_credits.balance + $2,
                    total_earned = user_credits.total_earned + $2,
                    paid_balance = user_credits.paid_balance + $2,
                    updated_at = NOW()`,
                [wrap.user_id, creatorShare]
            );

            // 插入购买记录
            await client.query(
                `INSERT INTO wrap_purchases (buyer_id, wrap_id, credits_paid, creator_credits_earned)
                 VALUES ($1, $2, $3, $4)`,
                [user.id, wrapId, priceCredits, creatorShare]
            );

            // 买家 credit_ledger
            await client.query(
                `INSERT INTO credit_ledger (user_id, amount, type, description, metadata, created_at)
                 VALUES ($1, $2, 'marketplace_purchase', $3, $4::jsonb, NOW())`,
                [user.id, -priceCredits, `购买付费贴图`, JSON.stringify({ wrap_id: wrapId, creator_id: wrap.user_id })]
            );

            // 创作者 credit_ledger
            await client.query(
                `INSERT INTO credit_ledger (user_id, amount, type, description, metadata, created_at)
                 VALUES ($1, $2, 'creator_earning', $3, $4::jsonb, NOW())`,
                [wrap.user_id, creatorShare, `贴图销售收益`, JSON.stringify({ wrap_id: wrapId, buyer_id: user.id })]
            );

            // 更新 wraps.creator_earnings
            await client.query(
                `UPDATE wraps SET creator_earnings = creator_earnings + $2 WHERE id = $1`,
                [wrapId, creatorShare]
            );

            await client.query('COMMIT');
            committed = true;

            // 读取最新余额
            const { rows: updatedCreditRows } = await client.query(
                `SELECT paid_balance FROM user_credits WHERE user_id = $1 LIMIT 1`,
                [user.id]
            );

            return NextResponse.json({
                success: true,
                remainingPaidBalance: Number(updatedCreditRows[0]?.paid_balance || 0)
            });
        } catch (err) {
            if (!committed) {
                await client.query('ROLLBACK');
            }
            console.error('[marketplace purchase] transaction failed:', err);
            return NextResponse.json({ error: '购买失败，请重试' }, { status: 500 });
        } finally {
            client.release();
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[marketplace purchase] error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
