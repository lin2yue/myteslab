'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type CreditsContextValue = {
    balance: number | null;
    loading: boolean;
    refresh: () => Promise<void>;
    setBalance: (value: number | null) => void;
};

const CreditsContext = createContext<CreditsContextValue | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchBalance = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/credits/balance', { cache: 'no-store' });
            const data = await res.json();
            setBalance(typeof data?.balance === 'number' ? data.balance : null);
        } catch (e) {
            console.error('CreditsProvider: fetch balance error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    useEffect(() => {
        const handler = () => {
            if (document.visibilityState === 'visible') {
                fetchBalance();
            }
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, [fetchBalance]);

    const value: CreditsContextValue = {
        balance,
        loading,
        refresh: async () => {
            await fetchBalance();
        },
        setBalance
    };

    return (
        <CreditsContext.Provider value={value}>
            {children}
        </CreditsContext.Provider>
    );
}

export function useCredits() {
    const context = useContext(CreditsContext);
    if (!context) {
        throw new Error('useCredits must be used within CreditsProvider');
    }
    return context;
}
