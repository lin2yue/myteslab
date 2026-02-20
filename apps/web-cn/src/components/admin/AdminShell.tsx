'use client';

import React, { useState, useEffect } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, History, Wallet, ShieldCheck, Users, BarChart } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    const navItems = [
        { name: 'Analytics', href: '/admin/stats', icon: BarChart },
        { name: 'Users', href: '/admin/users', icon: Users },
        { name: 'AI Tasks', href: '/admin/tasks', icon: History },
        { name: 'Works', href: '/admin/wraps', icon: LayoutDashboard },
        { name: 'Credit Ledger', href: '/admin/credits', icon: Wallet },
    ];

    const NavContent = () => (
        <>
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
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium',
                                isActive
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                            )}
                        >
                            <Icon className={cn(
                                'w-5 h-5 transition-colors',
                                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                            )} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-100 dark:border-zinc-800">
                <Link
                    href="/"
                    className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <LayoutDashboard className="w-4 h-4" />
                    Back to Site
                </Link>
            </div>
        </>
    );

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex-col fixed inset-y-0 z-50">
                <NavContent />
            </aside>

            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 z-50 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-blue-600" />
                    <span className="font-bold text-lg tracking-tight">Admin Console</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                    {isMobileMenuOpen ? <div className="w-6 h-6 flex items-center justify-center">✕</div> : <div className="space-y-1.5 w-6"><div className="h-0.5 bg-current w-full"></div><div className="h-0.5 bg-current w-full"></div><div className="h-0.5 bg-current w-full"></div></div>}
                </button>
            </header>

            {/* Mobile Sidebar Overlay & Drawer */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[60] lg:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />

                    {/* Drawer */}
                    <aside className="absolute top-0 left-0 bottom-0 w-64 bg-white dark:bg-zinc-900 shadow-xl flex flex-col animate-in slide-in-from-left duration-200">
                        <div className="flex justify-between items-center pr-4">
                            {/* Re-use NavContent for the list, but we might need a close button if the header isn't visible in the drawer */}
                        </div>
                        <NavContent />
                    </aside>
                </div>
            )}

            <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 mt-16 lg:mt-0 overflow-auto w-full">
                {children}
            </main>
        </div>
    );
}
