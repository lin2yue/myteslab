import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
    const t = await getTranslations('NotFound');

    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
            <div className="relative mb-8">
                <span className="text-[150px] font-black text-gray-100 dark:text-zinc-900 leading-none select-none">
                    404
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-black rounded-2xl rotate-12 flex items-center justify-center shadow-2xl shadow-black/20">
                        <span className="text-white font-black text-4xl">T</span>
                    </div>
                </div>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
                {t('title')}
            </h1>
            <p className="text-gray-500 dark:text-zinc-400 max-w-md mx-auto mb-10 leading-relaxed font-medium">
                {t('desc')}
            </p>

            <Link
                href="/"
                className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl font-bold hover:scale-105 transition-all shadow-xl shadow-black/10 active:scale-95"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                {t('explore_btn')}
            </Link>

            <div className="mt-16 w-full max-w-lg">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 opacity-60">
                    {t('popular_models')}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                    {[
                        { name: 'Model 3', slug: 'model-3' },
                        { name: 'Model Y', slug: 'model-y' },
                        { name: 'Cybertruck', slug: 'cybertruck' }
                    ].map(model => (
                        <Link
                            key={model.slug}
                            href={`/models/${model.slug}`}
                            className="px-5 py-2.5 bg-gray-50 dark:bg-zinc-800/50 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-white hover:shadow-md hover:text-black dark:hover:bg-zinc-800 dark:hover:text-white transition-all border border-transparent hover:border-gray-200 dark:hover:border-zinc-700"
                        >
                            {model.name}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
