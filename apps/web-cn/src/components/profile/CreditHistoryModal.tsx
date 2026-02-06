'use client';

import { X } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { PRICING_TIERS } from '@/lib/constants/credits';
import Portal from '@/components/Portal';

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
        <Portal>
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-2xl bg-white/90 dark:bg-zinc-900/80 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-black/5 dark:border-white/10 backdrop-blur">
                <div className="flex items-center justify-between p-6">
                    <h3 className="text-xl font-bold text-gray-900">{t('purchase_history')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 font-sans">
                    {history.length > 0 ? (
                        <div className="space-y-4">
                            {history.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between p-4 bg-white/70 dark:bg-zinc-900/70 rounded-2xl border border-black/5 dark:border-white/10 hover:border-black/15 transition-colors group">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-gray-900 dark:text-white leading-tight">
                                                {getSkuName(tx.metadata?.polar_product_id)}
                                            </p>
                                            <span className="text-[10px] bg-black/5 dark:bg-white/10 text-gray-700 dark:text-zinc-200 px-1.5 py-0.5 rounded-md font-bold border border-black/10 dark:border-white/10">
                                                {t('success')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1.5">
                                            {new Date(tx.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-gray-900 dark:text-white group-hover:scale-110 transition-transform origin-right">
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

                <div className="p-4 bg-white/70 dark:bg-zinc-900/50 text-center border-t border-black/5 dark:border-white/10 backdrop-blur">
                    <p className="text-xs text-gray-400">
                        Only successful top-up records are shown.
                    </p>
                </div>
            </div>
        </div>
        </Portal>
    );
}
