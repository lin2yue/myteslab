'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { trackPurchase } from '@/lib/analytics';

export default function CheckoutSuccessPage() {
    const t = useTranslations('Checkout');
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const tierName = searchParams.get('tier_name');
    const amount = searchParams.get('amount');
    const hasTracked = useRef(false);

    useEffect(() => {
        if (sessionId && tierName && amount && !hasTracked.current) {
            hasTracked.current = true;
            trackPurchase(
                sessionId,
                parseFloat(amount),
                'USD',
                [{
                    item_id: tierName, // Using tier name keys (basic, pro, etc) as ID
                    item_name: tierName,
                    price: parseFloat(amount)
                }]
            );
        }
    }, [sessionId, tierName, amount]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-transparent px-4">
            <div className="max-w-md w-full panel p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="flex justify-center mb-6">
                    <div className="p-3 rounded-full bg-green-100/80 text-green-600">
                        <CheckCircle2 className="w-16 h-16" />
                    </div>
                </div>

                <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100 mb-4">
                    {t('success_title')}
                </h1>

                <p className="text-gray-600 mb-8 leading-relaxed">
                    {t('success_desc')}
                </p>

                <div className="space-y-4">
                    <Link
                        href="/ai-generate/generate"
                        className="block w-full btn-primary h-12"
                    >
                        {t('back_to_generator')}
                    </Link>

                    <Link
                        href="/profile"
                        className="block w-full btn-secondary h-12"
                    >
                        {t('view_balance')}
                    </Link>
                </div>

                <p className="mt-8 text-sm text-gray-400">
                    Any questions? Contact us at support@myteslab.com
                </p>
            </div>
        </div>
    );
}
