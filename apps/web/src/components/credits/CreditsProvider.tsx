'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type CreditsContextValue = {
    balance: number | null;
    loading: boolean;
    refresh: () => Promise<void>;
    setBalance: (value: number | null) => void;
};

const CreditsContext = createContext<CreditsContextValue | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
    const supabase = useMemo(() => createClient(), []);
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    const fetchBalance = useCallback(async (uid: string | null) => {
        if (!uid) {
            setBalance(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data: credits } = await supabase
                .from('user_credits')
                .select('balance')
                .eq('user_id', uid)
                .single();
            setBalance(credits?.balance ?? 0);
        } catch (e) {
            console.error('CreditsProvider: fetch balance error:', e);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!isMounted) return;
            const uid = session?.user?.id ?? null;
            setUserId(uid);
            await fetchBalance(uid);
        };

        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const uid = session?.user?.id ?? null;
            setUserId(uid);
            fetchBalance(uid);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [supabase, fetchBalance]);

    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`credits_${userId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'user_credits',
                filter: `user_id=eq.${userId}`
            }, (payload) => {
                setBalance(payload.new.balance);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, userId]);

    useEffect(() => {
        const handler = () => {
            if (document.visibilityState === 'visible') {
                fetchBalance(userId);
            }
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, [userId, fetchBalance]);

    const value: CreditsContextValue = {
        balance,
        loading,
        refresh: async () => {
            await fetchBalance(userId);
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
