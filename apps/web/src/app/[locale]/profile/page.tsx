import { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server';
import { redirect } from '@/i18n/routing';
import AuthButton from '@/components/auth/AuthButton';
import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import ProfileForm from './ProfileForm';
import ProfileContent from './ProfileContent';

export const metadata: Metadata = {
    title: 'My Profile - MyTesLab',
    robots: {
        index: false,
    },
};

export default async function ProfilePage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return redirect({ href: '/login', locale });
    }

    // 并行获取所有数据，减少串行等待时间
    const [profileRes, creditsRes, wrapsRes, downloadsRes, modelsRes] = await Promise.all([
        supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).single(),
        supabase.from('user_credits').select('balance, total_earned').eq('user_id', user.id).single(),
        supabase.from('wraps').select('id, name, prompt, texture_url, preview_url, is_public, created_at, model_slug').eq('user_id', user.id).is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('user_downloads').select('id, downloaded_at, wraps(id, name, preview_url, texture_url)').eq('user_id', user.id).order('downloaded_at', { ascending: false }).limit(20),
        supabase.from('wrap_models').select('slug, model_3d_url')
    ]);

    const profile = profileRes.data;
    const credits = creditsRes.data;
    const generatedWraps = wrapsRes.data;
    const wrapsError = wrapsRes.error;
    const wrapModels = modelsRes.data || [];

    // 适配 Supabase 关联查询返回的数组格式为对象
    const downloads = downloadsRes.data?.map(item => ({
        ...item,
        wraps: Array.isArray(item.wraps) ? item.wraps[0] : item.wraps
    })) || [];

    if (wrapsError) {
        console.error('Debug: Querying wraps failed:', wrapsError.message);
    }

    const t = await getTranslations('Profile');
    const tCommon = await getTranslations('Common');

    return (
        <div className="flex flex-col min-h-screen">
            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex-1 w-full">
                <div className="flex items-center gap-4 mb-8">
                    <h1 className="text-3xl font-black text-gray-900">{t('title')}</h1>
                </div>
                {/* User Info & Credits */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white overflow-hidden shadow rounded-lg p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">{t('user_details')}</h2>
                        <div className="flex items-center">
                            <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500 mr-4">
                                {profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">{t('email')}</p>
                                <p className="text-lg font-semibold text-gray-900">{user.email}</p>
                                <ProfileForm
                                    initialDisplayName={profile?.display_name || ''}
                                    userId={user.id}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg p-6 flex flex-col">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">{t('credits')}</h2>
                        <div className="flex-1 flex flex-col justify-center">
                            <div className="flex items-center justify-between">
                                <div className="flex items-baseline">
                                    <span className="text-4xl font-extrabold text-blue-600 mr-2">
                                        {credits?.balance || 0}
                                    </span>
                                    <span className="text-gray-500">{t('available_credits')}</span>
                                </div>
                                <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                    {t('buy_more')}
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                                {t('total_earned')}: {credits?.total_earned || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <ProfileContent
                    generatedWraps={generatedWraps || []}
                    downloads={downloads || []}
                    wrapModels={wrapModels}
                />
            </main>
        </div>
    );
}
