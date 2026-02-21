'use client';

import { X } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import Portal from '@/components/Portal';

export interface CreditTransaction {
    id: string;
    amount: number;
    type: string;
    description: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
    wraps?: {
        preview_url: string;
        prompt: string;
    } | null;
    balance_after?: number | null;
}

interface CreditHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: CreditTransaction[];
}

export default function CreditHistoryModal({ isOpen, onClose, history }: CreditHistoryModalProps) {
    const t = useTranslations('Profile');

    if (!isOpen) return null;

    const classifyRecord = (tx: CreditTransaction) => {
        const type = String(tx.type || '').toLowerCase();
        const description = String(tx.description || '').toLowerCase();
        const metadataSource = String(tx.metadata?.source || '').toLowerCase();

        if (
            description.includes('new user') ||
            description.includes('registration') ||
            metadataSource === 'new_user_signup'
        ) {
            return t('points_type_signup_gift');
        }

        if (type === 'generation' || type === 'generation_charge') {
            return t('points_type_generation');
        }
        if (type === 'refund') {
            return t('points_type_refund');
        }
        if (type === 'top-up') {
            return t('points_type_top_up');
        }
        if (type === 'admin_adjustment' || type === 'adjustment') {
            return tx.amount >= 0 ? t('points_type_admin_gift') : t('points_type_admin_deduct');
        }
        if (
            type === 'reward' ||
            type === 'system_reward' ||
            type === 'system_gift' ||
            type === 'grant'
        ) {
            return t('points_type_system_gift');
        }
        return tx.amount >= 0 ? t('points_type_income') : t('points_type_expense');
    };

    const getAmountClassName = (amount: number) => {
        if (amount > 0) return 'text-emerald-600 dark:text-emerald-400';
        if (amount < 0) return 'text-red-600 dark:text-red-400';
        return 'text-gray-700 dark:text-zinc-300';
    };

    const getTypeBadgeClassName = (tx: CreditTransaction) => {
        const type = String(tx.type || '').toLowerCase();

        if (type === 'refund') {
            return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
        }

        if (type === 'generation' || type === 'generation_charge' || tx.amount < 0) {
            return 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30';
        }

        if (tx.amount > 0) {
            return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30';
        }

        return 'bg-black/5 text-gray-700 border-black/10 dark:bg-white/10 dark:text-zinc-200 dark:border-white/10';
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
                                            <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-md font-bold border ${getTypeBadgeClassName(tx)}`}>
                                                {classifyRecord(tx)}
                                            </span>
                                        </div>
                                        {(tx.wraps?.prompt || tx.description) && (
                                            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">
                                                {tx.wraps?.prompt || tx.description}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-1.5">
                                            {new Date(tx.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-xl font-black group-hover:scale-110 transition-transform origin-right ${getAmountClassName(tx.amount)}`}>
                                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                                        </p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-tighter font-bold">
                                            {t('history_amount')}
                                        </p>
                                        {typeof tx.balance_after === 'number' && (
                                            <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
                                                {t('history_balance')}: {Math.abs(tx.balance_after)}
                                            </p>
                                        )}
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

            </div>
        </div>
        </Portal>
    );
}
