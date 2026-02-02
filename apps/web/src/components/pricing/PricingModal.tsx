'use client';

import { X, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRICING_TIERS, type PricingTier } from '@/lib/constants/credits';
import PricingTierCard from './PricingTierCard';
import Portal from '../Portal';

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
        <Portal>
            <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:p-6 pt-10 pb-10">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />

                <div className="relative w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-zinc-100 dark:border-zinc-800">

                    {/* Header */}
                    <div className="flex flex-col items-center justify-center pt-10 pb-6 px-6 text-center">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1 tracking-tight">{t('title')}</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-lg leading-relaxed text-sm font-medium">{t('subtitle')}</p>
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-10 pb-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-4xl mx-auto pt-4 leading-none">
                            {tiers.map((tier) => (
                                <PricingTierCard key={tier.id} tier={tier} />
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 text-center border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 tracking-wider font-semibold uppercase">
                            {t('secure_payment_desc')}
                        </p>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
