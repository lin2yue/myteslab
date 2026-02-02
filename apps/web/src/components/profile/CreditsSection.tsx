'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import PricingModal from '@/components/pricing/PricingModal';
import CreditHistoryModal from './CreditHistoryModal';
import UsageHistoryModal from './UsageHistoryModal';

interface CreditsSectionProps {
    balance: number;
    totalEarned: number;
    history: any[];
    usageHistory: any[];
}

export default function CreditsSection({ balance, totalEarned, history, usageHistory }: CreditsSectionProps) {
    const t = useTranslations('Profile');
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isUsageOpen, setIsUsageOpen] = useState(false);

    return (
        <div className="bg-white overflow-hidden shadow rounded-lg p-6 flex flex-col h-full relative group">
            <h2 className="text-lg font-medium text-gray-900 mb-4">{t('credits')}</h2>

            <div className="flex-1 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-baseline">
                        <span className="text-4xl font-extrabold text-blue-600 mr-2">
                            {balance}
                        </span>
                        <span className="text-gray-500 text-sm font-medium">{t('available_credits')}</span>
                    </div>
                    <button
                        onClick={() => setIsPricingOpen(true)}
                        className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 whitespace-nowrap"
                    >
                        {t('buy_more')}
                    </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 border-t border-gray-50 pt-4 gap-2">
                    <p className="text-sm text-gray-500">
                        {t('total_earned')}: <span className="font-bold text-gray-700">{totalEarned}</span>
                    </p>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="text-xs text-blue-600 font-bold hover:underline"
                        >
                            {t('purchase_history')} →
                        </button>
                        <button
                            onClick={() => setIsUsageOpen(true)}
                            className="text-xs text-gray-500 font-bold hover:underline"
                        >
                            {t('usage_history')} →
                        </button>
                    </div>
                </div>
            </div>

            <PricingModal
                isOpen={isPricingOpen}
                onClose={() => setIsPricingOpen(false)}
            />

            <CreditHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                history={history}
            />

            <UsageHistoryModal
                isOpen={isUsageOpen}
                onClose={() => setIsUsageOpen(false)}
                history={usageHistory}
            />
        </div>
    );
}
