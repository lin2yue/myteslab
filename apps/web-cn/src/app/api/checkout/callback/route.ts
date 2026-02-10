import { redirect } from 'next/navigation';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const amount = searchParams.get('total_amount') || searchParams.get('amount');
    const credits = searchParams.get('credits');

    // Alipay returns many params like out_trade_no, trade_no in GET returnUrl
    // We just need to redirect user to a nice success UI.

    const targetParams = new URLSearchParams();
    if (amount) targetParams.append('amount', amount);
    if (credits) targetParams.append('credits', credits);

    // Redirect to the existing success page
    redirect(`/checkout/success?${targetParams.toString()}`);
}
