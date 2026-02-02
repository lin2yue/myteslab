'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type PricingTier } from '@/lib/constants/credits';

interface PricingTierCardProps {
    tier: PricingTier;
    onBuySuccess?: (data: any) => void;
}

export default function PricingTierCard({ tier }: PricingTierCardProps) {
    const t = useTranslations('Pricing');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleBuy = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: tier.polarProductId }),
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else if (data.error === 'Unauthorized') {
                const currentUrl = window.location.pathname + window.location.search;
                router.push(`/login?next=${encodeURIComponent(currentUrl)}`);
            } else {
                alert(data.error || 'Failed to create checkout session');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const features = t.raw(`features.${tier.nameKey}`) as string[];

    return (
        <div
            className={`relative flex flex-col p-6 lg:p-7 rounded-[2rem] border transition-all duration-300 text-center bg-white dark:bg-zinc-900 ${tier.popular
                ? 'border-blue-500 shadow-[0_20px_40px_rgba(59,130,246,0.1)] scale-105 z-10'
                : 'border-gray-200 dark:border-zinc-800 shadow-xl'
                }`}
        >
            {tier.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg whitespace-nowrap">
                    {t('most_popular')}
                </div>
            )}

            {/* Header Area */}
            <div className="mb-6">
                <h3 className="text-xl font-bold mb-1 text-gray-900 dark:text-white">
                    {t(`tiers.${tier.nameKey}`)}
                </h3>
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-500">
                    {t(`descriptions.${tier.nameKey}`)}
                </p>

                <div className="mt-8 flex flex-col items-center">
                    <div className="flex items-baseline justify-center">
                        <span className="text-[3rem] leading-none font-black tracking-tight text-gray-900 dark:text-white">
                            ${tier.price.replace('.99', '.9')}
                        </span>
                    </div>
                    <div className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                        {tier.credits} {t('credits')}
                    </div>
                </div>
            </div>

            {/* Features List */}
            <div className="flex-1 space-y-3 mb-8 text-left px-2">
                {features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" strokeWidth={3} />
                        <span className="text-[12px] font-medium leading-relaxed text-gray-600 dark:text-zinc-400">
                            {feature.replace('{count}', tier.generations.toString())}
                        </span>
                    </div>
                ))}
            </div>

            {/* Action Button */}
            <button
                onClick={handleBuy}
                disabled={loading}
                className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-md ${loading
                    ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 cursor-wait'
                    : tier.popular
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none'
                        : 'bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-zinc-200'
                    }`}
            >
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    t('choose_plan')
                )}
            </button>
        </div>
    );
}
