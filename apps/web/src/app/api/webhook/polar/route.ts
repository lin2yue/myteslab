import { Webhooks } from '@polar-sh/nextjs';
import { createAdminClient } from '@/utils/supabase/admin';
import { PRICING_TIERS } from '@/lib/constants/credits';

export const POST = Webhooks({
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
    onPayload: async (event: any) => {
        console.log('Received Polar webhook event:', event.type);

        if (event.type === 'checkout.updated' && event.data.status === 'succeeded') {
            const checkout = event.data;
            const userId = checkout.customer_metadata?.supabase_user_id;
            const productId = checkout.product_id;

            if (!userId) {
                console.error('No user ID found in checkout metadata');
                return;
            }

            let creditsToAdd = 0;

            // 1. 优先通过 productId 匹配套餐积分，这可以处理使用 100% 优惠券（金额为0）的情况
            const matchedTier = PRICING_TIERS.find(t => t.polarProductId === productId);
            if (matchedTier) {
                creditsToAdd = matchedTier.credits;
                console.log(`Webhook: Matched product ${productId} to tier ${matchedTier.id}, adding ${creditsToAdd} credits`);
            }
            // 2. 如果 productId 没匹配到，尝试通过金额兜底计算
            else if (checkout.amount) {
                const amountUsd = checkout.amount / 100;
                // 同步最新的积分档位：700 / 250 / 100
                if (amountUsd >= 19) creditsToAdd = 700;
                else if (amountUsd >= 9) creditsToAdd = 250;
                else if (amountUsd >= 4) creditsToAdd = 100;
                else creditsToAdd = Math.floor(amountUsd * 20); // 兜底：$1 = 20 credits

                console.log(`Webhook: Falling back to amount calculation for ${amountUsd} USD, adding ${creditsToAdd} credits`);
            }

            if (creditsToAdd > 0) {
                const adminClient = createAdminClient();
                const { error } = await adminClient.rpc('add_credits_from_payment', {
                    p_user_id: userId,
                    p_amount: creditsToAdd,
                    p_description: `Purchase of ${creditsToAdd} credits via Polar.sh (Checkout: ${checkout.id})`,
                    p_metadata: { polar_checkout_id: checkout.id, polar_product_id: productId }
                });

                if (error) {
                    console.error('Error updating credits:', error);
                } else {
                    console.log(`Successfully added ${creditsToAdd} credits to user ${userId}`);
                }
            }
        }
    },
});
