import { useTranslations } from '@/lib/i18n';
import { getTranslations } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations('Legal.tos');
    const description = '特玩 服务条款 - 了解我们的规则、所有权以及特斯拉贴图设计的许可协议。';

    return {
        title: `${t('title')} - 特玩`,
        description,
        alternates: {
            canonical: `/${locale}/terms`,
        },
    };
}

export default function LegalPage() {
    const tTos = useTranslations('Legal.tos');
    const tPrivacy = useTranslations('Legal.privacy');
    const tRefund = useTranslations('Legal.refund');

    return (
        <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
            <div className="space-y-20">
                {/* Terms of Service Section */}
                <section id="terms">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl border-b pb-4 border-gray-200 dark:border-zinc-800">
                        {tTos('title')}
                    </h1>
                    <div className="mt-8 space-y-8 text-lg text-gray-600 dark:text-zinc-400">
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tTos('s1_title')}</h2>
                            <p>{tTos('s1_content')}</p>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tTos('s2_title')}</h2>
                            <p>{tTos('s2_content')}</p>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tTos('s3_title')}</h2>
                            <div className="pl-4 border-l-2 border-gray-100 dark:border-zinc-800 space-y-4">
                                <div>
                                    <h3 className="font-semibold text-gray-800 dark:text-zinc-200">{tTos('s3_ownership_title')}</h3>
                                    <p>{tTos('s3_ownership_content')}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 dark:text-zinc-200">{tTos('s3_uploads_title')}</h3>
                                    <p>{tTos('s3_uploads_content')}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 dark:text-zinc-200">{tTos('s3_sharing_title')}</h3>
                                    <p>{tTos('s3_sharing_content')}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 dark:text-zinc-200">{tTos('s3_license_title')}</h3>
                                    <p>{tTos('s3_license_content')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tTos('s4_title')}</h2>
                            <p>{tTos('s4_content')}</p>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tTos('s5_title')}</h2>
                            <p>{tTos('s5_content')}</p>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tTos('s6_title')}</h2>
                            <p>{tTos('s6_content')}</p>
                        </div>
                    </div>
                </section>

                {/* Privacy Policy Section */}
                <section id="privacy">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl border-b pb-4 border-gray-200 dark:border-zinc-800">
                        {tPrivacy('title')}
                    </h1>
                    <div className="mt-8 space-y-8 text-lg text-gray-600 dark:text-zinc-400">
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tPrivacy('s1_title')}</h2>
                            <p>{tPrivacy('s1_content')}</p>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tPrivacy('s2_title')}</h2>
                            <p>{tPrivacy('s2_content')}</p>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tPrivacy('s3_title')}</h2>
                            <p>{tPrivacy('s3_content')}</p>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tPrivacy('s4_title')}</h2>
                            <p>{tPrivacy('s4_content')}</p>
                        </div>
                    </div>
                </section>

                {/* Refund Policy Section */}
                <section id="refund">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl border-b pb-4 border-gray-200 dark:border-zinc-800">
                        {tRefund('title')}
                    </h1>
                    <div className="mt-8 space-y-8 text-lg text-gray-600 dark:text-zinc-400">
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tRefund('s1_title')}</h2>
                            <p>{tRefund('s1_content')}</p>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tRefund('s2_title')}</h2>
                            <p>{tRefund('s2_content')}</p>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tRefund('s3_title')}</h2>
                            <p>{tRefund('s3_content')}</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
