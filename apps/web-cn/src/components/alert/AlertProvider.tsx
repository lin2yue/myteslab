'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AlertContainer from './AlertContainer';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface Alert {
    id: string;
    type: AlertType;
    message: string;
    duration?: number;
}

interface AlertContextType {
    showAlert: (message: string, type?: AlertType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
    const [alerts, setAlerts] = useState<Alert[]>([]);

    const showAlert = useCallback((message: string, type: AlertType = 'info', duration: number = 3000) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newAlert: Alert = { id, type, message, duration };

        setAlerts((prev) => [...prev, newAlert]);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                setAlerts((prev) => prev.filter((alert) => alert.id !== id));
            }, duration);
        }
    }, []);

    const success = useCallback((message: string, duration?: number) => {
        showAlert(message, 'success', duration);
    }, [showAlert]);

    const error = useCallback((message: string, duration?: number) => {
        showAlert(message, 'error', duration);
    }, [showAlert]);

    const warning = useCallback((message: string, duration?: number) => {
        showAlert(message, 'warning', duration);
    }, [showAlert]);

    const info = useCallback((message: string, duration?: number) => {
        showAlert(message, 'info', duration);
    }, [showAlert]);

    const removeAlert = useCallback((id: string) => {
        setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert, success, error, warning, info }}>
            {children}
            <AlertContainer alerts={alerts} onRemove={removeAlert} />
        </AlertContext.Provider>
    );
}

export function useAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within AlertProvider');
    }
    return context;
}
