import { Webhooks } from '@polar-sh/nextjs';
import { createAdminClient } from '@/utils/supabase/admin';
import { PRICING_TIERS } from '@/lib/constants/credits';
import { NextResponse } from 'next/server';

// We'll use a custom POST handler to allow for raw logging before verification
export async function POST(request: Request) {
    const secret = process.env.POLAR_WEBHOOK_SECRET;

    if (!secret) {
        console.error('[Polar-Webhook] ❌ CRITICAL: POLAR_WEBHOOK_SECRET is not set!');
        return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('webhook-signature') || request.headers.get('polar-webhook-signature');

    console.log(`[Polar-Webhook] 📥 Incoming request. Signature present: ${!!signature}, Body length: ${body.length}`);

    // Use the official validator but wrapped so we can see errors
    try {
        const adminClient = createAdminClient();

        const result = await Webhooks({
            webhookSecret: secret,
            onPayload: async (event: any) => {
                const { type, data } = event;
                console.log(`[Polar-Webhook] 🔔 Event Received: ${type}`);

                // Log every event to the DB for debugging
                await adminClient.from('webhook_logs').insert({
                    event_type: type,
                    payload: event,
                    status: 'received'
                });

                if (type === 'checkout.updated' || type === 'order.created' || type === 'subscription.created') {
                    const status = data.status;

                    if (status === 'succeeded' || status === 'paid' || type === 'order.created') {
                        const metadata = data.customer_metadata || data.metadata || {};
                        const userId = metadata.supabase_user_id;
                        const productId = data.product_id;

                        if (!userId) {
                            console.error('[Polar-Webhook] ❌ User ID missing. Metadata received:', JSON.stringify(metadata));
                            await adminClient.from('webhook_logs').insert({
                                event_type: type,
                                payload: event,
                                status: 'error',
                                error_msg: `User ID missing. Metadata: ${JSON.stringify(metadata)}`
                            });
                            return;
                        }

                        let creditsToAdd = 0;
                        const matchedTier = PRICING_TIERS.find(t => t.polarProductId === productId);

                        if (matchedTier) {
                            creditsToAdd = matchedTier.credits;
                        } else if (data.amount) {
                            const amountUsd = data.amount / 100;
                            if (amountUsd >= 19) creditsToAdd = 700;
                            else if (amountUsd >= 9) creditsToAdd = 250;
                            else if (amountUsd >= 4) creditsToAdd = 100;
                            else creditsToAdd = Math.floor(amountUsd * 20);
                        }

                        if (creditsToAdd > 0) {
                            const { data: rpcRes, error: rpcError } = await adminClient.rpc('add_credits_from_payment', {
                                p_user_id: userId,
                                p_amount: creditsToAdd,
                                p_description: `Top-up via Polar (${type}: ${data.id})`,
                                p_metadata: {
                                    polar_id: data.id,
                                    polar_product_id: productId,
                                    amount: data.amount,
                                    event: type
                                }
                            });

                            if (rpcError) {
                                console.error('[Polar-Webhook] ❌ DB Error:', rpcError.message);
                                await adminClient.from('webhook_logs').insert({
                                    event_type: type,
                                    payload: event,
                                    status: 'rpc_error',
                                    error_msg: rpcError.message
                                });
                            } else {
                                console.log('[Polar-Webhook] ✅ Credits Added');
                                await adminClient.from('webhook_logs').insert({
                                    event_type: type,
                                    payload: event,
                                    status: 'success',
                                    error_msg: `Added ${creditsToAdd} credits`
                                });
                            }
                        } else {
                            console.log('[Polar-Webhook] ℹ️ Credits amount is 0, skipping DB update.');
                        }
                    } else {
                        console.log(`[Polar-Webhook] ⏭️ Skipping status: ${status}`);
                    }
                }
            }
        })(new Request(request.url, {
            method: 'POST',
            headers: request.headers,
            body: body
        }) as any);

        return result;
    } catch (err: any) {
        console.error('[Polar-Webhook] 💥 Error:', err.message);
        // Fallback logging if Webhooks() wrapper fails
        const adminClient = createAdminClient();
        await adminClient.from('webhook_logs').insert({
            event_type: 'raw_error',
            payload: { body: body.substring(0, 1000) },
            status: 'error',
            error_msg: err.message
        });
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 });
    }
}
