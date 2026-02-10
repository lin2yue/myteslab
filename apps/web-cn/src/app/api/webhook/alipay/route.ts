import { NextResponse } from 'next/server';
import { getAlipaySdk } from '@/lib/alipay';
import { dbQuery } from '@/lib/db';
import { PRICING_TIERS } from '@/lib/constants/credits';

export async function POST(request: Request) {
    console.log('[Alipay Webhook] Received request');

    let params: Record<string, string> = {}; // Declare outside try for error logging usage

    try {
        await dbQuery(`INSERT INTO webhook_events (provider, payload, status) VALUES ($1, $2, $3)`, ['alipay', '{}', 'entry_point_hit']);

        const alipaySdk = getAlipaySdk();
        const formData = await request.formData();

        formData.forEach((value, key) => {
            params[key] = value.toString();
        });

        await dbQuery(`INSERT INTO webhook_events (provider, payload, status) VALUES ($1, $2, $3)`, ['alipay', JSON.stringify(params), 'params_parsed']);

        console.log('[Alipay Webhook] Received params:', params);

        // --- DEBUG: Log raw request to DB ---
        try {
            await dbQuery(
                `INSERT INTO webhook_events (provider, payload, status) VALUES ($1, $2, $3)`,
                ['alipay', JSON.stringify(params), 'received']
            );
        } catch (e) {
            console.error('[Alipay Webhook] Failed to log event:', e);
        }
        // -------------------------------------

        // 1. Verify Signature
        const isValid = alipaySdk.checkNotifySign(params);
        if (!isValid) {
            console.error('[Alipay Webhook] Invalid signature');
            // Log failure
            await dbQuery(
                `UPDATE webhook_events SET status = 'failed', error = 'Invalid Signature' 
                 WHERE provider = 'alipay' AND payload::text = $1::text AND created_at > NOW() - INTERVAL '1 minute'`,
                [JSON.stringify(params)]
            );
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
            // Note: transaction_id is stored in metadata in credit_ledger
            const { rows: existingLogs } = await dbQuery(
                `SELECT * FROM credit_ledger WHERE metadata->>'transaction_id' = $1`,
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

            // --- DEBUG: Log matching result ---
            await dbQuery(
                `UPDATE webhook_events SET error = $1 WHERE provider = 'alipay' AND payload::text = $2::text`,
                [`Matching: paid=${paidAmount}, matched=${matchedTier?.id}, credits=${creditsToAdd}`, JSON.stringify(params)]
            );
            // ----------------------------------

            if (creditsToAdd === 0) {
                console.error(`[Alipay Webhook] Could not match price ${totalAmount} to any tier.`);
                // --- DEBUG: Log zero credits ---
                await dbQuery(
                    `UPDATE webhook_events SET status = 'failed', error = $1 WHERE provider = 'alipay' AND payload::text = $2::text`,
                    [`No tier matched for amount ${totalAmount}`, JSON.stringify(params)]
                );
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

                // --- DEBUG: Log success ---
                await dbQuery(
                    `UPDATE webhook_events SET status = 'success', error = 'Credits Added' WHERE provider = 'alipay' AND payload::text = $1::text`,
                    [JSON.stringify(params)]
                );
            } catch (dbError: any) {
                console.error('[Alipay Webhook] Database update failed:', dbError);
                // --- DEBUG: Log DB failure ---
                await dbQuery(
                    `UPDATE webhook_events SET status = 'failed', error = $1 WHERE provider = 'alipay' AND payload::text = $2::text`,
                    [`DB Error: ${dbError.message}`, JSON.stringify(params)]
                );
                return new Response('fail', { status: 500 });
            }
        }

        return new Response('success');
    } catch (error: any) {
        console.error('[Alipay Webhook] Error:', error);
        // --- DEBUG: Log top-level error ---
        try {
            if (Object.keys(params).length > 0) {
                await dbQuery(
                    `UPDATE webhook_events SET status = 'failed', error = $1 WHERE provider = 'alipay' AND payload::text = $2::text`,
                    [`Top-level Error: ${error.message}`, JSON.stringify(params)]
                );
            } else {
                await dbQuery(
                    `INSERT INTO webhook_events (provider, payload, status, error) VALUES ($1, $2, $3, $4)`,
                    ['alipay', '{}', 'failed', `Top-level Error (No Params): ${error.message}`]
                );
            }
        } catch (e) {
            console.error('Failed to log top-level error:', e);
        }
        return new Response('fail', { status: 500 });
    }
}
