'use client';

import { X, Check } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
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
            {/* 外层：负责整页滚动，min-h-full + flex 保证内容短时居中，内容长时从顶部开始 */}
            <div className="fixed inset-0 z-[100] overflow-y-auto">
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />
                <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
                    <div className="relative w-full max-w-7xl bg-white/90 dark:bg-zinc-900/80 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-black/5 dark:border-white/10 backdrop-blur">

                        {/* Header — sticky，关闭按钮始终可见 */}
                        <div className="sticky top-0 z-10 flex flex-col items-center justify-center pt-10 pb-6 px-6 text-center bg-white/90 dark:bg-zinc-900/80 rounded-t-3xl backdrop-blur">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1 tracking-tight">{t('title')}</h2>
                            <p className="text-zinc-500 dark:text-zinc-400 max-w-lg leading-relaxed text-sm font-medium">{t('subtitle')}</p>
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 sm:px-10 pb-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch max-w-6xl mx-auto pt-4 leading-none">
                                {tiers.map((tier) => (
                                    <PricingTierCard key={tier.id} tier={tier} />
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-white/60 dark:bg-zinc-900/40 text-center border-t border-black/5 dark:border-white/10 backdrop-blur rounded-b-3xl">
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 tracking-wider font-semibold uppercase">
                                {t('secure_payment_desc')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
