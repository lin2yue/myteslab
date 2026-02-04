'use client';

import { Alert } from './AlertProvider';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface AlertContainerProps {
    alerts: Alert[];
    onRemove: (id: string) => void;
}

export default function AlertContainer({ alerts, onRemove }: AlertContainerProps) {
    if (alerts.length === 0) return null;

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3 max-w-md w-full px-4">
            {alerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} onRemove={onRemove} />
            ))}
        </div>
    );
}

function AlertItem({ alert, onRemove }: { alert: Alert; onRemove: (id: string) => void }) {
    const getAlertStyles = () => {
        switch (alert.type) {
            case 'success':
                return {
                    bg: 'bg-green-50 dark:bg-green-900/20',
                    border: 'border-green-200 dark:border-green-800',
                    text: 'text-green-800 dark:text-green-200',
                    icon: <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                };
            case 'error':
                return {
                    bg: 'bg-red-50 dark:bg-red-900/20',
                    border: 'border-red-200 dark:border-red-800',
                    text: 'text-red-800 dark:text-red-200',
                    icon: <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                };
            case 'warning':
                return {
                    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
                    border: 'border-yellow-200 dark:border-yellow-800',
                    text: 'text-yellow-800 dark:text-yellow-200',
                    icon: <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                };
            case 'info':
            default:
                return {
                    bg: 'bg-black/5 dark:bg-white/10',
                    border: 'border-black/10 dark:border-white/10',
                    text: 'text-gray-800 dark:text-gray-200',
                    icon: <Info className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                };
        }
    };

    const styles = getAlertStyles();

    return (
        <div
            className={`${styles.bg} ${styles.border} border rounded-lg shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-top-2 fade-in duration-300`}
            role="alert"
        >
            <div className="flex-shrink-0 mt-0.5">
                {styles.icon}
            </div>
            <div className={`flex-1 ${styles.text} text-sm font-medium`}>
                {alert.message}
            </div>
            <button
                onClick={() => onRemove(alert.id)}
                className={`flex-shrink-0 ${styles.text} hover:opacity-70 transition-opacity`}
                aria-label="Close"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
