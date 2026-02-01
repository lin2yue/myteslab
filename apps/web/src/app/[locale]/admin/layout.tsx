'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, History, Wallet, RefreshCcw, ShieldCheck, Users } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const t = useTranslations('Common');
    const locale = useLocale();
    const pathname = usePathname();

    const navItems = [
        {
            name: 'Users',
            href: `/${locale}/admin/users`,
            icon: Users,
        },
        {
            name: 'AI Tasks',
            href: `/${locale}/admin/tasks`,
            icon: History,
        },
        {
            name: 'Credit Ledger',
            href: `/${locale}/admin/credits`,
            icon: Wallet,
        },
        {
            name: 'Batch Refresh',
            href: `/${locale}/admin/batch-refresh`,
            icon: RefreshCcw,
        },
    ];

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col fixed inset-y-0 z-50">
                <div className="p-6 flex items-center gap-3 border-b border-gray-100 dark:border-zinc-800">
                    <ShieldCheck className="w-6 h-6 text-blue-600" />
                    <span className="font-bold text-lg tracking-tight">Admin Console</span>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                                    isActive
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                                )}
                            >
                                <Icon className={cn(
                                    "w-5 h-5 transition-colors",
                                    isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                                )} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100 dark:border-zinc-800">
                    <Link
                        href={`/${locale}`}
                        className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Back to Site
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8 overflow-auto">
                {children}
            </main>
        </div>
    );
}
