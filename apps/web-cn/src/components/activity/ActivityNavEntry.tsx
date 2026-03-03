'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type ActivityEntrySummary = {
    visible: boolean;
    href: string;
    activityId: string | null;
    label: string;
    badge: string | null;
    title: string;
};

function GiftIcon() {
    return (
        <svg
            viewBox="0 0 15 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-[18px] w-[18px]"
            aria-hidden="true"
        >
            <path
                d="M7.5 4.50037V14.2504M7.5 4.50037C7.22871 3.38242 6.76159 2.42663 6.15955 1.7577C5.55752 1.08878 4.84851 0.737728 4.125 0.750333C3.62772 0.750333 3.15081 0.947877 2.79917 1.29951C2.44754 1.65114 2.25 2.12805 2.25 2.62533C2.25 3.12261 2.44754 3.59953 2.79917 3.95116C3.15081 4.30279 3.62772 4.50033 4.125 4.50033M7.5 4.50037C7.77129 3.38242 8.23841 2.42663 8.84045 1.7577C9.44248 1.08878 10.1515 0.737728 10.875 0.750333C11.3723 0.750333 11.8492 0.947877 12.2008 1.29951C12.5525 1.65114 12.75 2.12805 12.75 2.62533C12.75 3.12261 12.5525 3.59953 12.2008 3.95116C11.8492 4.30279 11.3723 4.50033 10.875 4.50033M12.75 7.50037V12.7504C12.75 13.1482 12.592 13.5297 12.3107 13.811C12.0294 14.0923 11.6478 14.2504 11.25 14.2504H3.75C3.35218 14.2504 2.97064 14.0923 2.68934 13.811C2.40804 13.5297 2.25 13.1482 2.25 12.7504V7.50037M1.5 4.50037H13.5C13.9142 4.50037 14.25 4.83616 14.25 5.25037V6.75037C14.25 7.16459 13.9142 7.50037 13.5 7.50037H1.5C1.08579 7.50037 0.75 7.16459 0.75 6.75037V5.25037C0.75 4.83616 1.08579 4.50037 1.5 4.50037Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function ActivityNavEntry() {
    const pathname = usePathname();
    const [summary, setSummary] = useState<ActivityEntrySummary | null>(null);

    useEffect(() => {
        let disposed = false;

        const load = async () => {
            const res = await fetch('/api/activities/summary', { cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.visible || disposed) return;
            setSummary(data as ActivityEntrySummary);
        };

        load().catch(() => {});

        return () => {
            disposed = true;
        };
    }, []);

    if (!summary?.visible) return null;

    const hrefPath = summary.href.split('?')[0] || summary.href;
    const isActive = pathname?.startsWith(hrefPath);

    return (
        <Link
            href={summary.href}
            title={summary.title}
            aria-label={summary.title}
            className={`inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 text-sm font-medium text-[#8F4C00] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD9A5] sm:h-[34px] sm:justify-start sm:px-[13px] ${isActive
                ? 'border-[#F6D2A0] bg-[#FFB752]/40'
                : 'border-[#FFE1B9] bg-[#FFB752]/[0.27] hover:bg-[#FFB752]/[0.34]'
                }`}
        >
            <span className="inline-flex h-[18px] w-[18px] items-center justify-center text-[#8F4C00]">
                <GiftIcon />
            </span>
            <span className="hidden whitespace-nowrap sm:inline">活动榜单</span>
        </Link>
    );
}
