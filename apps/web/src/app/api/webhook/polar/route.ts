import { Webhooks } from '@polar-sh/nextjs';
import { createAdminClient } from '@/utils/supabase/admin';
import { PRICING_TIERS } from '@/lib/constants/credits';

export const POST = Webhooks({
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
    onPayload: async (event: any) => {
        console.log(`[Polar-Webhook] Received event: ${event.type}`);

        if (event.type === 'checkout.updated' || event.type === 'order.created') {
            const data = event.data;
            const status = data.status;
            console.log(`[Polar-Webhook] Processing ${event.type} with status: ${status}`);

            // Only process completed checkouts or created orders
            if (status === 'succeeded' || status === 'paid' || event.type === 'order.created') {
                const userId = data.customer_metadata?.supabase_user_id || data.metadata?.supabase_user_id;
                const productId = data.product_id;

                console.log(`[Polar-Webhook] Data summary: userId=${userId}, productId=${productId}, amount=${data.amount}`);

                if (!userId) {
                    console.error('[Polar-Webhook] ❌ No user ID found in metadata. Payload:', JSON.stringify(data.metadata || data.customer_metadata));
                    return;
                }

                let creditsToAdd = 0;

                // 1. Through productId
                const matchedTier = PRICING_TIERS.find(t => t.polarProductId === productId);
                if (matchedTier) {
                    creditsToAdd = matchedTier.credits;
                    console.log(`[Polar-Webhook] ✅ Matched productId ${productId} to ${creditsToAdd} credits`);
                }
                // 2. Through amount fallback
                else if (data.amount) {
                    const amountUsd = data.amount / 100;
                    if (amountUsd >= 19) creditsToAdd = 700;
                    else if (amountUsd >= 9) creditsToAdd = 250;
                    else if (amountUsd >= 4) creditsToAdd = 100;
                    else creditsToAdd = Math.floor(amountUsd * 20);
                    console.log(`[Polar-Webhook] ⚠️ Fallback deduction: ${amountUsd} USD -> ${creditsToAdd} credits`);
                }

                if (creditsToAdd > 0) {
                    console.log(`[Polar-Webhook] 🚀 Attempting to add ${creditsToAdd} credits to user ${userId}...`);
                    const adminClient = createAdminClient();
                    const { data: res, error } = await adminClient.rpc('add_credits_from_payment', {
                        p_user_id: userId,
                        p_amount: creditsToAdd,
                        p_description: `Purchase via Polar (Event: ${event.type}, ID: ${data.id})`,
                        p_metadata: { polar_id: data.id, polar_product_id: productId, event_type: event.type }
                    });

                    if (error) {
                        console.error('[Polar-Webhook] ❌ RPC Error:', error.message);
                    } else {
                        console.log(`[Polar-Webhook] ✨ Successfully added credits. Result:`, res);
                    }
                } else {
                    console.log('[Polar-Webhook] ℹ️ Zero credits to add, skipping RPC.');
                }
            }
        }
    },
});
