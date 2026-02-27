'use client';

import { useEffect } from 'react';
import { consumeAuthRedirectNext } from '@/lib/auth/client-redirect';

export default function AuthCallbackHandler() {
    useEffect(() => {
        const handleRedirect = () => {
            console.log('[AuthCallbackHandler] Handling OAuth redirect');

            const queryNext = new URLSearchParams(window.location.search).get('next');
            const next = consumeAuthRedirectNext(queryNext, '/');
            console.log('[AuthCallbackHandler] resolved next:', next);

            console.log('[AuthCallbackHandler] Redirecting to:', next);
            // Use replace to force a full page reload and ensure auth state is updated
            window.location.replace(next);
        };

        // Small delay to ensure session is established
        setTimeout(handleRedirect, 100);
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                <p className="text-gray-600">正在跳转...</p>
            </div>
        </div>
    );
}
