'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PRICING_TIERS } from '@/lib/constants/credits';

interface Transaction {
    id: string;
    amount: number;
    description: string;
    created_at: string;
    metadata: any;
}

interface CreditHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: Transaction[];
}

export default function CreditHistoryModal({ isOpen, onClose, history }: CreditHistoryModalProps) {
    const t = useTranslations('Profile');
    const tPricing = useTranslations('Pricing');

    if (!isOpen) return null;

    const getSkuName = (productId: string) => {
        const tier = PRICING_TIERS.find(t => t.polarProductId === productId);
        return tier ? tPricing(`tiers.${tier.id}`) : t('credits');
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6">
                    <h3 className="text-xl font-bold text-gray-900">{t('purchase_history')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 font-sans">
                    {history.length > 0 ? (
                        <div className="space-y-4">
                            {history.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800 hover:border-blue-200 transition-colors group">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-gray-900 dark:text-white leading-tight">
                                                {getSkuName(tx.metadata?.polar_product_id)}
                                            </p>
                                            <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md font-bold border border-blue-100 dark:border-blue-800/50">
                                                {t('success')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1.5">
                                            {new Date(tx.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform origin-right">
                                            +{tx.amount}
                                        </p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-tighter font-bold">
                                            {t('history_amount')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-gray-500">
                            {t('no_history')}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 text-center">
                    <p className="text-xs text-gray-400">
                        Only successful top-up records are shown.
                    </p>
                </div>
            </div>
        </div>
    );
}
