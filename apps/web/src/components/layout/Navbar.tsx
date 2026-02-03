'use client';

import { Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import AuthButton from '@/components/auth/AuthButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { usePathname } from 'next/navigation';

export default function Navbar() {
    const t = useTranslations('Index');
    const tCommon = useTranslations('Common');
    const locale = useLocale();
    const pathname = usePathname();

    // 检查当前是否在 AI 生成页面，如果是，可以做一些特殊的样式调整
    const isAiPage = pathname?.includes('/ai-generate/');
    const isPricingPage = pathname?.includes('/pricing');

    return (
        <header className="bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50 border-b border-black/5 dark:border-white/10">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between gap-4">
                    {/* Left: Logo & Navigation */}
                    <div className="flex items-center gap-6 lg:gap-10">
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform duration-300 shadow-[0_8px_16px_rgba(0,0,0,0.18)] ring-1 ring-black/10 dark:ring-white/10">
                                <span className="text-white dark:text-black font-black text-xl">T</span>
                            </div>
                            <span className="hidden sm:block text-xl font-black tracking-tighter text-gray-900 dark:text-white group-hover:text-gray-900 transition-colors">
                                {t('title')}
                            </span>
                        </Link>

                        <nav className="hidden md:flex items-center gap-6 lg:gap-8 border-l border-gray-100 dark:border-zinc-800 pl-6 lg:pl-10 ml-2">
                            <Link
                                href="/"
                                className={`text-base font-bold transition-all ${!isAiPage && !isPricingPage
                                    ? 'text-gray-950 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-200'
                                    }`}
                            >
                                {tCommon('nav.gallery')}
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
                            <Link
                                href="/pricing"
                                className={`text-base font-bold transition-all ${isPricingPage
                                    ? 'text-gray-950 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-200'
                                    }`}
                            >
                                {tCommon('nav.pricing')}
                            </Link>
                        </nav>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 sm:gap-6">
                        {/* Mobile Nav Links (Simple Icon) */}
                        <div className="flex md:hidden items-center gap-2">
                            <Link href="/" className={`p-2 rounded-lg ${!isAiPage && !isPricingPage ? 'text-white bg-black' : 'text-gray-500'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </Link>
                            <Link href="/ai-generate/generate" className={`p-2 rounded-lg ${isAiPage ? 'text-white bg-black' : 'text-gray-500'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.96 1.414l-.722 2.166a2 2 0 00.556 2.228l1.714 1.428a2 2 0 002.57 0l1.714-1.428a2 2 0 00.556-2.228l-.722-2.166zM12 9V7m0 12v-2m4.636-9.636l-1.414-1.414M6.778 17.222l-1.414-1.414M17.222 17.222l1.414-1.414M6.778 6.778l1.414 1.414M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </Link>
                            <Link href="/pricing" className={`p-2 rounded-lg ${isPricingPage ? 'text-white bg-black' : 'text-gray-500'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </Link>
                        </div>

                        <div className="h-6 w-[1px] bg-gray-200 dark:bg-zinc-800 mx-1" />

                        <div className="flex items-center gap-2 sm:gap-4">
                            <LanguageSwitcher />
                            <AuthButton />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
