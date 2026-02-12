import { useTranslations } from '@/lib/i18n';
import { getTranslations } from '@/lib/i18n';

export async function generateMetadata() {
    const t = await getTranslations('Legal.privacy');
    const description = '特玩 隐私政策 - 我们重视您的隐私，并说明我们如何处理您的数据。';

    return {
        title: `${t('title')} - 特玩`,
        description,
        alternates: {
            canonical: '/privacy',
        },
    };
}

export default function PrivacyPage() {
    const t = useTranslations('Legal.privacy');

    return (
        <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                {t('title')}
            </h1>
            <div className="mt-12 space-y-12 text-lg text-gray-600 dark:text-zinc-400">
                <section>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {t('s1_title')}
                    </h2>
                    <p className="mt-4">{t('s1_content')}</p>
                </section>

                <section>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {t('s2_title')}
                    </h2>
                    <p className="mt-4">{t('s2_content')}</p>
                </section>
            </div>
        </div>
    );
}
