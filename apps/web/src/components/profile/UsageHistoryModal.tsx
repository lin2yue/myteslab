'use client';

import { X, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage';

interface UsageRecord {
    id: string;
    amount: number;
    description: string;
    created_at: string;
    wraps?: {
        preview_url: string;
        prompt: string;
    } | null;
}

interface UsageHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: UsageRecord[];
}

export default function UsageHistoryModal({ isOpen, onClose, history }: UsageHistoryModalProps) {
    const t = useTranslations('Profile');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6">
                    <h3 className="text-xl font-bold text-gray-900">{t('usage_history')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 font-sans">
                    {history.length > 0 ? (
                        <div className="space-y-4">
                            {history.map((record) => (
                                <div key={record.id} className="flex gap-4 p-4 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl border border-gray-100 dark:border-zinc-800 hover:border-blue-200 transition-colors group">
                                    <div className="w-16 h-16 rounded-xl bg-gray-200 dark:bg-zinc-800 overflow-hidden flex-shrink-0 relative border border-gray-100 dark:border-zinc-700 shadow-sm">
                                        {record.wraps?.preview_url ? (
                                            <ResponsiveOSSImage
                                                src={record.wraps.preview_url}
                                                alt="Preview"
                                                fill
                                                className="object-contain p-1 group-hover:scale-110 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <ImageIcon className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug">
                                            {record.wraps?.prompt || record.description}
                                        </p>
                                        <div className="flex items-center justify-between mt-2.5">
                                            <p className="text-[10px] text-gray-400 font-medium">
                                                {new Date(record.created_at).toLocaleString()}
                                            </p>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/30">
                                                <span className="text-sm font-black">{record.amount}</span>
                                                <span className="text-[9px] font-bold uppercase tracking-tighter">{t('usage_credits')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-gray-500">
                            {t('usage_no_history')}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 text-center">
                    <p className="text-xs text-gray-400">
                        Records display individual AI generation credit consumption.
                    </p>
                </div>
            </div>
        </div>
    );
}
