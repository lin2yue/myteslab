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

    if (!isOpen) return null;

    const getSkuName = (productId: string) => {
        const tier = PRICING_TIERS.find(t => t.polarProductId === productId);
        return tier ? t(`../Pricing.tiers.${tier.id}`) : t('credits');
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-900">{t('purchase_history')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 font-sans">
                    {history.length > 0 ? (
                        <div className="space-y-4">
                            {history.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900 leading-tight">
                                            {getSkuName(tx.metadata?.polar_product_id)}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {new Date(tx.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-blue-600">
                                            +{tx.amount}
                                        </p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-tighter">
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

                <div className="p-4 bg-gray-50 border-t text-center">
                    <p className="text-xs text-gray-400">
                        Only successful top-up records are shown.
                    </p>
                </div>
            </div>
        </div>
    );
}
