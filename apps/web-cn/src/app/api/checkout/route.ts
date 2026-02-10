import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import alipaySdk from '@/lib/alipay';
import { PRICING_TIERS } from '@/lib/constants/credits';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { productId, locale } = await request.json();

        const tier = PRICING_TIERS.find(t => t.id === productId);
        if (!tier) {
            return NextResponse.json({ error: 'Invalid Product ID' }, { status: 400 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const localePrefix = locale ? `/${locale}` : '';

        // Generate a unique out_trade_no (User ID + Timestamp)
        const outTradeNo = `${user.id.slice(0, 8)}-${Date.now()}`;

        // Create Alipay trade
        const result = await alipaySdk.pageExec('alipay.trade.page.pay', {
            method: 'GET', // Returns a redirect URL
            bizContent: {
                out_trade_no: outTradeNo,
                product_code: 'FAST_INSTANT_TRADE_PAY',
                total_amount: tier.price,
                subject: `特玩积分充值 - ${tier.credits} 积分`,
                body: JSON.stringify({
                    userId: user.id,
                    credits: tier.credits,
                    tierId: tier.id,
                }),
                // Notify URL should be accessible by Alipay (public IP/Domain)
                passback_params: encodeURIComponent(JSON.stringify({ userId: user.id })),
            },
            returnUrl: `${appUrl}${localePrefix}/checkout/success?amount=${tier.price}&credits=${tier.credits}`,
            notifyUrl: `${appUrl}/api/webhook/alipay`, // MUST BE PUBLIC SECURE URL
        });

        // result is the URL for GET method
        return NextResponse.json({ url: result });
    } catch (error: any) {
        console.error('Alipay checkout error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
