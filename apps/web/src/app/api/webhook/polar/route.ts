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
        const result = await Webhooks({
            webhookSecret: secret,
            onPayload: async (event: any) => {
                const { type, data } = event;
                console.log(`[Polar-Webhook] 🔔 Event Received: ${type}, ID: ${data.id}`);

                if (type === 'checkout.updated' || type === 'order.created' || type === 'subscription.created') {
                    const status = data.status;
                    console.log(`[Polar-Webhook] Processing ${type} with status: ${status}`);

                    if (status === 'succeeded' || status === 'paid' || type === 'order.created') {
                        // Extract user ID from various possible metadata locations
                        const metadata = data.customer_metadata || data.metadata || {};
                        const userId = metadata.supabase_user_id;
                        const productId = data.product_id;

                        console.log(`[Polar-Webhook] 🕵️ Data Analysis:
                            - UserID: ${userId}
                            - ProductID: ${productId}
                            - Amount: ${data.amount}
                            - Metadata: ${JSON.stringify(metadata)}
                        `);

                        if (!userId) {
                            console.error('[Polar-Webhook] ❌ User ID missing in metadata! Check checkout session creation.');
                            return;
                        }

                        let creditsToAdd = 0;
                        const matchedTier = PRICING_TIERS.find(t => t.polarProductId === productId);

                        if (matchedTier) {
                            creditsToAdd = matchedTier.credits;
                            console.log(`[Polar-Webhook] 🎯 Matched ProductID ${productId} -> ${creditsToAdd} Credits`);
                        } else if (data.amount) {
                            const amountUsd = data.amount / 100;
                            // Pricing logic sync
                            if (amountUsd >= 19) creditsToAdd = 700;
                            else if (amountUsd >= 9) creditsToAdd = 250;
                            else if (amountUsd >= 4) creditsToAdd = 100;
                            else creditsToAdd = Math.floor(amountUsd * 20);
                            console.log(`[Polar-Webhook] ⚖️ Fallback calculation: ${amountUsd} USD -> ${creditsToAdd} Credits`);
                        }

                        if (creditsToAdd > 0) {
                            const adminClient = createAdminClient();
                            console.log(`[Polar-Webhook] 🏦 Invoking add_credits_from_payment for user ${userId}...`);
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
                            } else {
                                console.log('[Polar-Webhook] ✅ Credits Added Successfully:', rpcRes);
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
        }));

        return result;
    } catch (err: any) {
        console.error('[Polar-Webhook] 💥 Validation or Processing Error:', err.message);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 });
    }
}
