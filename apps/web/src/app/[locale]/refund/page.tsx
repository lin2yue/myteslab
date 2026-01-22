import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Legal.refund' });
    return {
        title: `${t('title')} - MyTesLab`,
    };
}

export default function RefundPage() {
    const t = useTranslations('Legal.refund');

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
