import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { polar } from '@/lib/polar';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { productId, locale } = await request.json();

        if (!productId) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const localePrefix = locale ? `/${locale}` : '';

        // Create a checkout session
        // We pass the user's ID in customerMetadata to identify them in the webhook
        const result = await polar.checkouts.create({
            products: [productId],
            customerMetadata: {
                supabase_user_id: user.id,
            },
            // You can also add success/failure URLs here
            successUrl: `${appUrl}${localePrefix}/checkout/success?session_id={CHECKOUT_ID}`,
        });

        return NextResponse.json({ url: result.url });
    } catch (error: any) {
        console.error('Error creating checkout session:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
