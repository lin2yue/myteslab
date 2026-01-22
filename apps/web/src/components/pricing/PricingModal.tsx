'use client';

import { X, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTier: (tierId: string) => void;
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

export default function PricingModal({ isOpen, onClose, onSelectTier }: PricingModalProps) {
    const t = useTranslations('Pricing');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900">{t('title')}</h2>
                        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-12 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {tiers.map((tier) => (
                            <div
                                key={tier.id}
                                className={`relative flex flex-col p-6 rounded-2xl border-2 transition-all duration-200 bg-white ${tier.popular
                                    ? 'border-blue-500 shadow-xl shadow-blue-100 scale-105 md:-mt-4 md:mb-4 z-10'
                                    : 'border-transparent shadow-sm hover:border-gray-200 hover:shadow-md'
                                    }`}
                            >
                                {tier.popular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm whitespace-nowrap">
                                        {t('most_popular')}
                                    </div>
                                )}

                                <div className="mb-6">
                                    <h3 className="text-lg font-bold text-gray-900">{t(`tiers.${tier.nameKey}`)}</h3>
                                    <div className="mt-4 flex items-baseline">
                                        <span className="text-4xl font-black text-gray-900">${tier.price}</span>
                                        <span className="ml-1 text-gray-500 font-medium">/USD</span>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500">
                                        {t('approx_cost', { cost: tier.costPerGen })}
                                    </p>
                                </div>

                                <div className="flex-1 space-y-4 mb-8">
                                    <div className="flex items-start gap-3">
                                        <div className="p-1 rounded-full bg-blue-50 text-blue-600 shrink-0">
                                            <Check className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="block font-bold text-gray-900">~{tier.generations} {t('generations')}</span>
                                            <span className="text-sm text-gray-500">{t('generations_desc')}</span>
                                        </div>
                                    </div>

                                    {/* Benefit Description */}
                                    <div className="flex items-start gap-3">
                                        <div className="p-1 rounded-full bg-purple-50 text-purple-600 shrink-0">
                                            <Check className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="block text-sm text-gray-700 font-medium">{t(`benefits.${tier.nameKey}`)}</span>
                                        </div>
                                    </div>

                                    {/* Value Proposition */}
                                    <div className="flex items-start gap-3">
                                        <div className="p-1 rounded-full bg-green-50 text-green-600 shrink-0">
                                            <Check className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="block text-sm text-gray-700 font-medium">
                                                {t(`values.${tier.nameKey}`, { cost: tier.costPerGen })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    disabled
                                    className="w-full py-4 rounded-xl font-bold transition-all cursor-not-allowed flex items-center justify-center gap-2 bg-gray-100 text-gray-400"
                                >
                                    {t('coming_soon')}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400">
                        {t('secure_payment_desc')}
                    </p>
                </div>
            </div>
        </div>
    );
}
