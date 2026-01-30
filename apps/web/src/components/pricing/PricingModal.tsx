'use client';

import { X, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRICING_TIERS, type PricingTier } from '@/lib/constants/credits';
import PricingTierCard from './PricingTierCard';

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTier?: (tierId: string) => void;
}

export default function PricingModal({ isOpen, onClose }: PricingModalProps) {
    const t = useTranslations('Pricing');
    const tiers = PRICING_TIERS;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-zinc-800">

                {/* Header */}
                <div className="flex flex-col items-center justify-center pt-12 pb-8 px-6 text-center">
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{t('title')}</h2>
                    <p className="text-gray-500 dark:text-zinc-400 max-w-lg leading-relaxed">{t('subtitle')}</p>
                    <button
                        onClick={onClose}
                        className="absolute top-8 right-8 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-8 py-10 bg-gray-50/30 dark:bg-zinc-950/30">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-4xl mx-auto">
                        {tiers.map((tier) => (
                            <PricingTierCard key={tier.id} tier={tier} />
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-white dark:bg-zinc-900 text-center border-t border-gray-100 dark:border-zinc-800">
                    <p className="text-xs text-gray-400 dark:text-zinc-500 tracking-wide uppercase">
                        {t('secure_payment_desc')}
                    </p>
                </div>
            </div>
        </div>
    );
}
