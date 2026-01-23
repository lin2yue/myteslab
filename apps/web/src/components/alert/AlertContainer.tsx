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
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full px-4 lg:px-0">
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
                    bg: 'bg-blue-50 dark:bg-blue-900/20',
                    border: 'border-blue-200 dark:border-blue-800',
                    text: 'text-blue-800 dark:text-blue-200',
                    icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
