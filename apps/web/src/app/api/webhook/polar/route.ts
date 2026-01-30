import { Webhooks } from '@polar-sh/nextjs';
import { createAdminClient } from '@/utils/supabase/admin';

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
            if (checkout.amount) {
                // Mapping: approx $1 = 20 credits (or use a precise mapping)
                // $4.99 -> 50 credits (~10/$)
                // $9.99 -> 125 credits (~12.5/$)
                // $19.99 -> 350 credits (~17.5/$)

                // Simplified dynamic calculation based on tiers
                const amountUsd = checkout.amount / 100;
                if (amountUsd >= 19) creditsToAdd = 350;
                else if (amountUsd >= 9) creditsToAdd = 125;
                else if (amountUsd >= 4) creditsToAdd = 50;
                else creditsToAdd = Math.floor(amountUsd * 10); // Fallback
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
