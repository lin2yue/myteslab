import { Check, Sparkles, Download, Eye, Share2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

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

interface PricingTier {
    id: string;
    nameKey: string;
    price: string;
    credits: number;
    generations: number;
    costPerGen: string;
    popular?: boolean;
    savings?: string;
}

const tiers: PricingTier[] = [
    {
        id: 'starter',
        nameKey: 'starter',
        price: '4.99',
        credits: 50,
        generations: 10,
        costPerGen: '0.49',
    },
    {
        id: 'explorer',
        nameKey: 'explorer',
        price: '9.99',
        credits: 125,
        generations: 25,
        costPerGen: '0.39',
        popular: true,
        savings: '20',
    },
    {
        id: 'collector',
        nameKey: 'collector',
        price: '19.99',
        credits: 350,
        generations: 70,
        costPerGen: '0.28',
        savings: '40',
    },
];

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
                    <p className="text-xl text-gray-600 dark:text-zinc-400 max-w-2xl mx-auto">
                        {t('subtitle')}
                    </p>
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6">
                    {tiers.map((tier) => (
                        <div
                            key={tier.id}
                            className={`relative flex flex-col p-8 rounded-3xl border-2 transition-all duration-200 bg-white dark:bg-zinc-900 ${tier.popular
                                ? 'border-blue-500 shadow-2xl shadow-blue-100 dark:shadow-blue-900/20 scale-105 md:-mt-4 md:mb-4 z-10'
                                : 'border-gray-200 dark:border-zinc-800 shadow-lg hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl'
                                }`}
                        >
                            {tier.popular && (
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider shadow-lg whitespace-nowrap">
                                    {t('most_popular')}
                                </div>
                            )}

                            {/* Tier Header */}
                            <div className="mb-8">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                                    {t(`tiers.${tier.nameKey}`)}
                                </h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-gray-900 dark:text-white">
                                        ${tier.price}
                                    </span>
                                    <span className="text-gray-500 dark:text-zinc-400 font-medium">/USD</span>
                                </div>
                                <p className="mt-3 text-sm text-gray-600 dark:text-zinc-400">
                                    {t('approx_cost', { cost: tier.costPerGen })}
                                </p>
                            </div>

                            {/* Features */}
                            <div className="flex-1 space-y-5 mb-8">
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                                        <Check className="w-5 h-5" strokeWidth={3} />
                                    </div>
                                    <div>
                                        <span className="block font-bold text-gray-900 dark:text-white">
                                            ~{tier.generations} {t('generations')}
                                        </span>
                                        <span className="text-sm text-gray-500 dark:text-zinc-400">
                                            {t('generations_desc')}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                                        <Check className="w-5 h-5" strokeWidth={3} />
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-700 dark:text-zinc-300 font-medium">
                                            {t(`benefits.${tier.nameKey}`)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 shrink-0 mt-0.5">
                                        <Check className="w-5 h-5" strokeWidth={3} />
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-700 dark:text-zinc-300 font-medium">
                                            {t(`values.${tier.nameKey}`, { cost: tier.costPerGen })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* CTA Button */}
                            <button
                                disabled
                                className="w-full py-4 rounded-xl font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2 bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500"
                            >
                                {t('coming_soon')}
                            </button>
                        </div>
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
