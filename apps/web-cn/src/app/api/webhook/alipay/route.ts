import { NextResponse } from 'next/server';
import { getAlipaySdk } from '@/lib/alipay';
import { dbQuery } from '@/lib/db';
import { PRICING_TIERS } from '@/lib/constants/credits';

export async function POST(request: Request) {
    console.log('[Alipay Webhook] Received request');
    try {
        const alipaySdk = getAlipaySdk();
        const formData = await request.formData();
        const params: Record<string, string> = {};
        formData.forEach((value, key) => {
            params[key] = value.toString();
        });

        console.log('[Alipay Webhook] Received params:', params);

        // 1. Verify Signature
        const isValid = alipaySdk.checkNotifySign(params);
        if (!isValid) {
            console.error('[Alipay Webhook] Invalid signature');
            return new Response('fail', { status: 400 });
        }

        // 2. Check Trade Status
        const tradeStatus = params.trade_status;
        const outTradeNo = params.out_trade_no;
        const tradeNo = params.trade_no; // Alipay transaction ID
        const totalAmount = params.total_amount;

        if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
            // 3. Process Business Logic (Idempotent)
            // Extract metadata from passback_params
            let metadata: any = {};
            try {
                if (params.passback_params) {
                    metadata = JSON.parse(decodeURIComponent(params.passback_params));
                }
            } catch (e) {
                console.error('[Alipay Webhook] Failed to parse passback_params:', e);
            }

            const userId = metadata.userId;

            // Re-fetch body if passback failed (though body is usually in biz_content which is not in notify)
            // In our checkout route we set body in bizContent, but notify only has out_trade_no
            // We'll rely on userId being in passback_params or we'd need a pending_orders table.

            if (!userId) {
                console.error('[Alipay Webhook] No userId found in passback_params');
                return new Response('fail', { status: 400 });
            }

            // Check if this transaction has already been processed (Idempotency)
            const { rows: existingLogs } = await dbQuery(
                'SELECT * FROM credit_logs WHERE transaction_id = $1',
                [tradeNo]
            );

            if (existingLogs.length > 0) {
                console.log('[Alipay Webhook] Transaction already processed:', tradeNo);
                return new Response('success');
            }



            // Determine credits based on total_amount
            const paidAmount = parseFloat(totalAmount);
            // Use a small epsilon for float comparison
            const matchedTier = PRICING_TIERS.find(t => Math.abs(parseFloat(t.price) - paidAmount) < 0.01);
            const creditsToAdd = matchedTier ? matchedTier.credits : 0;

            console.log(`[Alipay Webhook] Processing payment: amount=${totalAmount}, matchedCredits=${creditsToAdd}`);

            if (creditsToAdd === 0) {
                console.error(`[Alipay Webhook] Could not match price ${totalAmount} to any tier.`);
                // We return success to Alipay to stop retries, but log the error for manual intervention
                // return new Response('success'); 
                // For now, let's return fail so we can retry if it's a transient issue, 
                // but if it's a logic error, retrying won't help. 
                // Let's actually fail so we see it in logs if we have retry logic.
                return new Response('fail', { status: 400 });
            }

            // 4. Update Database (Transaction)
            // Note: Our dbQuery doesn't easily support transactions in this wrapper, 
            // but we can run sequential queries.
            try {
                // Add credits to balance
                // Add credits to balance (UPSERT)
                // Since our db wrapper doesn't support UPSERT syntax easily for all PG versions or complex joins, 
                // we'll try UPDATE first, if rowCount is 0, we INSERT.
                // Actually, standard PG "INSERT ... ON CONFLICT" is best.
                // Assuming user_id is PK or Unique.
                await dbQuery(
                    `INSERT INTO user_credits (user_id, balance, total_earned, updated_at)
                     VALUES ($1, $2, $2, NOW())
                     ON CONFLICT (user_id) 
                     DO UPDATE SET 
                        balance = user_credits.balance + $2,
                        total_earned = user_credits.total_earned + $2,
                        updated_at = NOW()`,
                    [userId, creditsToAdd]
                );

                // Log the transaction to credit_ledger
                await dbQuery(
                    `INSERT INTO credit_ledger (user_id, amount, type, description, metadata)
                     VALUES ($1, $2, 'top-up', $3, $4)`,
                    [
                        userId,
                        creditsToAdd,
                        `Alipay Top-up: ${tradeNo}`,
                        JSON.stringify({ ...params, transaction_id: tradeNo })
                    ]
                );

                console.log(`[Alipay Webhook] Success: Added ${creditsToAdd} credits to user ${userId} and logged transaction ${tradeNo}`);
            } catch (dbError) {
                console.error('[Alipay Webhook] Database update failed:', dbError);
                return new Response('fail', { status: 500 });
            }
        }

        return new Response('success');
    } catch (error: any) {
        console.error('[Alipay Webhook] Error:', error);
        return new Response('fail', { status: 500 });
    }
}
