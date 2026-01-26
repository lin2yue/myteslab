import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
    const t = await getTranslations('Index');
    const tCommon = await getTranslations('Common');

    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
            <div className="relative mb-8">
                <span className="text-[150px] font-black text-gray-100 dark:text-zinc-900 leading-none select-none">
                    404
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-blue-600 rounded-2xl rotate-12 flex items-center justify-center shadow-2xl shadow-blue-500/20">
                        <span className="text-white font-black text-4xl">T</span>
                    </div>
                </div>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
                Design Not Found
            </h1>
            <p className="text-gray-500 dark:text-zinc-400 max-w-md mx-auto mb-10 leading-relaxed font-medium">
                The Tesla wrap design you're looking for might have been moved or unpublished. But don't worry, there are plenty more to explore!
            </p>

            <Link
                href="/"
                className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl font-bold hover:scale-105 transition-all shadow-xl shadow-black/10 active:scale-95"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Explore Latest Designs
            </Link>
        </div>
    );
}
