'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { usePathname } from 'next/navigation';

export default function Footer() {
    const t = useTranslations('Footer');
    const pathname = usePathname();
    const currentYear = new Date().getFullYear();

    // Hide footer on AI generation page to keep it focused
    if (pathname?.includes('/ai-generate/')) {
        return null;
    }

    return (
        <footer className="mt-auto border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-8">
                    {/* Brand section */}
                    <div className="md:col-span-2">
                        <Link href="/" className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                            MyTesLab
                        </Link>
                        <p className="mt-4 text-sm text-gray-600 dark:text-zinc-400 max-w-xs">
                            {t('tagline')}
                        </p>
                    </div>

                    {/* Links section */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                            {t('links.explore')}
                        </h3>
                        <ul className="mt-4 space-y-3">
                            <li>
                                <Link href="/" className="text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    {t('links.explore')}
                                </Link>
                            </li>
                            <li>
                                <Link href="/pricing" className="text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    {t('links.pricing')}
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal section */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                            Legal
                        </h3>
                        <ul className="mt-4 space-y-3">
                            <li>
                                <Link href="/terms#terms" className="text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    {t('links.terms')}
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms#privacy" className="text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    {t('links.privacy')}
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms#refund" className="text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                    {t('links.refund')}
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom section */}
                <div className="mt-12 pt-8 border-t border-gray-200 dark:border-zinc-800">
                    <p className="text-xs text-center text-gray-500 dark:text-zinc-500">
                        {t('copyright', { year: currentYear })}
                    </p>
                    <p className="mt-2 text-xs text-center text-gray-400 dark:text-zinc-600 max-w-3xl mx-auto">
                        {t('disclaimer')}
                    </p>
                </div>
            </div>
        </footer>
    );
}
