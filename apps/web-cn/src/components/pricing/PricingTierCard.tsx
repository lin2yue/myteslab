'use client';

import { Check } from 'lucide-react';
import { useTranslations, useLocale } from '@/lib/i18n';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type PricingTier } from '@/lib/constants/credits';
import { trackBeginCheckout } from '@/lib/analytics';
import Button from '@/components/ui/Button';

interface PricingTierCardProps {
    tier: PricingTier;
    onBuySuccess?: (data: any) => void;
}

export default function PricingTierCard({ tier }: PricingTierCardProps) {
    const t = useTranslations('Pricing');
    const locale = useLocale();
    const [status, setStatus] = useState<'idle' | 'loading' | 'redirecting'>('idle');
    const router = useRouter();

    const handleBuy = async () => {
        // Track begin checkout
        trackBeginCheckout({
            id: tier.polarProductId || tier.id,
            name: t(`tiers.${tier.nameKey}`),
            price: parseFloat(tier.price),
        })

        setStatus('loading');
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: tier.polarProductId,
                    locale: locale,
                    metadata: {
                        tier_name: tier.nameKey, // Use key as stable identifier
                        price: parseFloat(tier.price),
                    }
                }),
            });

            const data = await response.json();

            if (data.url) {
                setStatus('redirecting');
                window.location.href = data.url;
            } else if (data.error === 'Unauthorized') {
                const currentUrl = window.location.pathname + window.location.search;
                router.push(`/login?next=${encodeURIComponent(currentUrl)}`);
                setStatus('idle');
            } else {
                alert(data.error || 'Failed to create checkout session');
                setStatus('idle');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Something went wrong. Please try again.');
            setStatus('idle');
        }
    };

    const features = t.raw(`features.${tier.nameKey}`) as string[];

    return (
        <div
            className={`relative flex flex-col p-8 rounded-3xl border transition-all duration-500 text-center bg-white/80 dark:bg-zinc-900/80 border-black/5 dark:border-white/10 shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_40px_rgba(0,0,0,0.10)] hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_26px_60px_rgba(0,0,0,0.14)] backdrop-blur ${tier.popular ? 'ring-1 ring-black/10 dark:ring-white/10' : ''
                }`}
        >
            {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xl border border-zinc-800 dark:border-zinc-200">
                    {t('most_popular')}
                </div>
            )}

            {/* Header Area */}
            <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-white">
                    {t(`tiers.${tier.nameKey}`)}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    {t(`descriptions.${tier.nameKey}`)}
                </p>

                <div className="mt-8 flex flex-col items-center">
                    <div className="flex items-baseline justify-center">
                        <span className="text-5xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                            ${tier.price.replace('.99', '.9')}
                        </span>
                    </div>
                    <div className="mt-4 px-3 py-1 rounded-full border text-zinc-600 dark:text-zinc-400 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-baseline justify-center gap-1">
                        <span className="text-base font-bold text-zinc-900 dark:text-white">
                            {tier.credits}
                        </span>
                        <span className="text-[11px] font-semibold">
                            {t('credits')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Features List */}
            <div className="flex-1 space-y-4 mb-8 text-left">
                {features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                        <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-400" strokeWidth={2.5} />
                        <span className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                            {feature.replace('{count}', tier.generations.toString())}
                        </span>
                    </div>
                ))}
            </div>

            {/* Action Button */}
            <Button
                onClick={handleBuy}
                disabled={true}
                className={`w-full rounded-2xl ${status !== 'idle' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-wait' : 'opacity-50 cursor-not-allowed'}`}
                size="lg"
            >
                {status !== 'idle' ? (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        <span className="text-sm font-semibold">
                            {status === 'redirecting' ? t('redirecting') : t('processing')}
                        </span>
                    </div>
                ) : (
                    t('coming_soon')
                )}
            </Button>
        </div>
    );
}
