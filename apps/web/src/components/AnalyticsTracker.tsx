'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function AnalyticsTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        const track = async () => {
            try {
                const fullPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
                
                await fetch('/api/analytics/track', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        pathname: fullPath,
                        referrer: document.referrer,
                    }),
                    keepalive: true,
                });
            } catch (err) {
                console.error('[Analytics Tracker Error]:', err);
            }
        };

        track();
    }, [pathname, searchParams]);

    return null;
}
