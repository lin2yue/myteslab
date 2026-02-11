'use client';

import Link from 'next/link'
import { usePathname } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';
import AuthButton from '@/components/auth/AuthButton';
import ThemeToggle from '@/components/ThemeToggle';
import Portal from '@/components/Portal';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Menu, Monitor, Moon, Sun, Zap } from 'lucide-react';
import { ThemeMode, useThemeMode } from '@/utils/theme';
import { useCredits } from '@/components/credits/CreditsProvider';

export default function Navbar() {
    const t = useTranslations('Index');
    const tCommon = useTranslations('Common');
    const pathname = usePathname();
    const { mode, setMode } = useThemeMode();
    const { balance, loading: creditsLoading } = useCredits();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // 当前主导航状态
    const isAiPage = pathname?.includes('/ai-generate/');
    const isLockSoundsPage = pathname?.startsWith('/lock-sounds');
    const isGalleryPage = !isAiPage && !isLockSoundsPage;

    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        } else {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [isMobileMenuOpen]);

    return (
        <header className="bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50 border-b border-black/5 dark:border-white/10">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between gap-4">
                    {/* Left: Logo & Navigation */}
                    <div className="flex items-center gap-6 lg:gap-10">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 bg-[#E31937] dark:bg-[#E31937] rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform duration-300 shadow-[0_8px_16px_rgba(227,25,55,0.25)] ring-1 ring-black/10 dark:ring-white/10">
                                <span className="text-white font-black text-xl">T</span>
                            </div>
                            <span className="hidden sm:block text-xl font-black tracking-tighter text-gray-900 dark:text-white transition-colors">
                                {t('title')}
                            </span>
                        </Link>

                        <nav className="hidden md:flex items-center gap-6 lg:gap-8 border-l border-gray-100 dark:border-zinc-800 pl-6 lg:pl-10 ml-2">
                            <Link
                                href="/"
                                className={`text-base font-bold transition-all ${isGalleryPage
                                    ? 'text-gray-950 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-200'
                                    }`}
                            >
                                {tCommon('nav.gallery')}
                            </Link>
                            <Link
                                href="/lock-sounds"
                                className={`text-base font-bold transition-all ${isLockSoundsPage
                                    ? 'text-gray-950 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-200'
                                    }`}
                            >
                                {tCommon('nav.lock_sounds')}
                            </Link>
                            <Link
                                href="/ai-generate/generate"
                                className={`text-base font-bold transition-all ${isAiPage
                                    ? 'text-gray-950 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-200'
                                    }`}
                            >
                                {tCommon('nav.ai_generator')}
                            </Link>
                        </nav>

                        {/* Mobile Primary Nav */}
                        <nav className="flex md:hidden items-center gap-2 border-l border-gray-100 dark:border-zinc-800 pl-3 ml-1 flex-nowrap overflow-x-auto no-scrollbar">
                            <Link
                                href="/"
                                className={`text-sm font-semibold whitespace-nowrap transition-colors ${isGalleryPage
                                    ? 'text-gray-900 dark:text-white'
                                    : 'text-gray-500 dark:text-zinc-400'
                                    }`}
                            >
                                {tCommon('nav.gallery')}
                            </Link>
                            <Link
                                href="/lock-sounds"
                                className={`text-sm font-semibold whitespace-nowrap transition-colors ${isLockSoundsPage
                                    ? 'text-gray-900 dark:text-white'
                                    : 'text-gray-500 dark:text-zinc-400'
                                    }`}
                            >
                                {tCommon('nav.lock_sounds')}
                            </Link>
                            <Link
                                href="/ai-generate/generate"
                                className={`text-sm font-semibold whitespace-nowrap transition-colors ${isAiPage
                                    ? 'text-gray-900 dark:text-white'
                                    : 'text-gray-500 dark:text-zinc-400'
                                    }`}
                            >
                                {tCommon('nav.ai_generator')}
                            </Link>
                        </nav>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1 sm:gap-4">
                        <div className="hidden md:flex items-center gap-1.5 sm:gap-2.5">
                            <ThemeToggle />
                        </div>
                        <div className="flex items-center gap-0.5 sm:gap-2">
                            <AuthButton />
                            {/* Mobile Menu */}
                            <div className="relative md:hidden">
                                <button
                                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                    className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                                    aria-label="菜单"
                                >
                                    <Menu size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isMobileMenuOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[200] md:hidden">
                        <div
                            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <div className="absolute inset-0 bg-white/98 dark:bg-zinc-950/98 overflow-y-auto">
                            <div className="h-16 px-4 flex items-center justify-between border-b border-black/5 dark:border-white/10">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    更多
                                </span>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                                    aria-label="关闭"
                                >
                                    <span className="text-lg leading-none">×</span>
                                </button>
                            </div>

                            <div className="p-5 space-y-6">
                                {!creditsLoading && balance !== null && (
                                    <div className="rounded-2xl bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 px-4 py-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                            积分
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center">
                                                <Zap className="w-4 h-4 text-gray-900 dark:text-white" />
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-black text-gray-900 dark:text-white">{balance}</span>
                                                <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                                                    可用积分
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                        主题
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { value: 'system', label: '系统', icon: <Monitor size={14} /> },
                                            { value: 'light', label: '浅色', icon: <Sun size={14} /> },
                                            { value: 'dark', label: '深色', icon: <Moon size={14} /> },
                                        ] as { value: ThemeMode; label: string; icon: ReactNode }[]).map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => {
                                                    setMode(option.value);
                                                    setIsMobileMenuOpen(false);
                                                }}
                                                className={`px-3 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${mode === option.value
                                                    ? 'bg-black/10 dark:bg-white/15 text-gray-900 dark:text-white'
                                                    : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-zinc-300'
                                                    }`}
                                            >
                                                {option.icon}
                                                {option.label}
                                                {mode === option.value && <Check size={12} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </header>
    );
}
