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
                    // 即使页面正在关闭也尝试发送
                    keepalive: true,
                });
            } catch (err) {
                // 静默失败，不打扰用户
                console.error('[Analytics Tracker Error]:', err);
            }
        };

        track();
    }, [pathname, searchParams]);

    return null;
}
