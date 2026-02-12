import { Check, Sparkles, Download, Eye, Share2 } from 'lucide-react';
import { getTranslations } from '@/lib/i18n';
import { PRICING_TIERS, type PricingTier } from '@/lib/constants/credits';
import PricingTierCard from '@/components/pricing/PricingTierCard';

export async function generateMetadata() {
    const t = await getTranslations('Pricing');

    return {
        title: t('page_title'),
        description: t('page_description'),
        alternates: {
            canonical: '/pricing',
        },
    };
}



export default async function PricingPage() {
    const t = await getTranslations('Pricing');

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* Hero Section */}
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                <div className="text-center">
                    <h1 className="text-3xl sm:text-4xl lg:text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
                        {t('title')}
                    </h1>
                    <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed font-medium">
                        {t('subtitle')}
                    </p>
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 lg:gap-6">
                    {PRICING_TIERS.map((tier) => (
                        <PricingTierCard key={tier.id} tier={tier} />
                    ))}
                </div>

                {/* Payment Security Notice */}
                <div className="mt-12 text-center">
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                        {t('secure_payment_desc')}
                    </p>
                </div>
            </div>

            {/* What You Get Section */}
            <div className="bg-white/70 dark:bg-zinc-900/50 border-y border-black/5 dark:border-white/10 backdrop-blur">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-24">
                    <h2 className="text-3xl font-bold text-zinc-900 dark:text-white text-center mb-20 tracking-tight">
                        {t('features_title')}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                        <div className="text-center group">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 mb-8 shadow-xl transition-transform group-hover:-translate-y-1 duration-300">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">
                                {t('feature_1_title')}
                            </h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-[13px] leading-relaxed">
                                {t('feature_1_desc')}
                            </p>
                        </div>

                        <div className="text-center group">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 mb-8 shadow-xl transition-transform group-hover:-translate-y-1 duration-300">
                                <Download className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">
                                {t('feature_2_title')}
                            </h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-[13px] leading-relaxed">
                                {t('feature_2_desc')}
                            </p>
                        </div>

                        <div className="text-center group">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 mb-8 shadow-xl transition-transform group-hover:-translate-y-1 duration-300">
                                <Eye className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">
                                {t('feature_3_title')}
                            </h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-[13px] leading-relaxed">
                                {t('feature_3_desc')}
                            </p>
                        </div>

                        <div className="text-center group">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 mb-8 shadow-xl transition-transform group-hover:-translate-y-1 duration-300">
                                <Share2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">
                                {t('feature_4_title')}
                            </h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-[13px] leading-relaxed">
                                {t('feature_4_desc')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white text-center mb-20 tracking-tight">
                    {t('faq_title')}
                </h2>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="py-10 first:pt-0 last:pb-0"
                        >
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">
                                {t(`faq_${i}_q`)}
                            </h3>
                            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-[13px] font-medium max-w-2xl">
                                {t(`faq_${i}_a`)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
