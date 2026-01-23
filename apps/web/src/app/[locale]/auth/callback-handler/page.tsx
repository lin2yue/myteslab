'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackHandler() {
    const router = useRouter();

    useEffect(() => {
        const handleRedirect = () => {
            console.log('[AuthCallbackHandler] Handling OAuth redirect');

            // Try to get the redirect URL from localStorage
            const next = localStorage.getItem('auth_redirect_next');
            console.log('[AuthCallbackHandler] next from localStorage:', next);

            if (next) {
                console.log('[AuthCallbackHandler] Redirecting to:', next);
                localStorage.removeItem('auth_redirect_next');
                window.location.href = next;
            } else {
                console.log('[AuthCallbackHandler] No redirect URL, going to home');
                router.push('/');
            }
        };

        // Small delay to ensure session is established
        setTimeout(handleRedirect, 100);
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">正在跳转...</p>
            </div>
        </div>
    );
}
