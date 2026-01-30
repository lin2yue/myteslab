import { Check, Sparkles, Download, Eye, Share2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PRICING_TIERS, type PricingTier } from '@/lib/constants/credits';
import PricingTierCard from '@/components/pricing/PricingTierCard';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Pricing' });

    return {
        title: t('page_title'),
        description: t('page_description'),
        alternates: {
            canonical: `/${locale}/pricing`,
            languages: {
                en: '/en/pricing',
                zh: '/zh/pricing',
            },
        },
    };
}



export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Pricing' });

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950">
            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                <div className="text-center">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white mb-6">
                        {t('title')}
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                        {t('subtitle')}
                    </p>
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6">
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
            <div className="bg-white dark:bg-zinc-900 border-y border-gray-200 dark:border-zinc-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                    <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white text-center mb-16">
                        {t('features_title')}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white mb-6 shadow-lg">
                                <Sparkles className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                                {t('feature_1_title')}
                            </h3>
                            <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed">
                                {t('feature_1_desc')}
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white mb-6 shadow-lg">
                                <Download className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                                {t('feature_2_title')}
                            </h3>
                            <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed">
                                {t('feature_2_desc')}
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white mb-6 shadow-lg">
                                <Eye className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                                {t('feature_3_title')}
                            </h3>
                            <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed">
                                {t('feature_3_desc')}
                            </p>
                        </div>

                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white mb-6 shadow-lg">
                                <Share2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                                {t('feature_4_title')}
                            </h3>
                            <p className="text-gray-600 dark:text-zinc-400 text-sm leading-relaxed">
                                {t('feature_4_desc')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white text-center mb-16">
                    {t('faq_title')}
                </h2>

                <div className="space-y-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                                {t(`faq_${i}_q`)}
                            </h3>
                            <p className="text-gray-600 dark:text-zinc-400 leading-relaxed">
                                {t(`faq_${i}_a`)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
