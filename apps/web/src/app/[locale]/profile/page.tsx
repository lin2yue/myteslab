import { createClient } from '@/utils/supabase/server';
import { redirect } from '@/i18n/routing';
import AuthButton from '@/components/auth/AuthButton';
import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import ProfileForm from './ProfileForm';
import ProfileContent from './ProfileContent';

export default async function ProfilePage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect({ href: '/login', locale });
    }

    // Fetch Profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    // Fetch Credits
    const { data: credits } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

    // Fetch Generated Wraps
    const { data: generatedWraps, error: wrapsError } = await supabase
        .from('wraps')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null) // 如果还是查不到，请运行 SQL 脚本加列
        .order('created_at', { ascending: false });

    if (wrapsError) {
        console.error('Debug: Querying wraps failed:', wrapsError.message);
    }

    // Fetch Downloads (Join with wraps table)
    const { data: downloads } = await supabase
        .from('user_downloads')
        .select('*, wraps(*)')
        .eq('user_id', user.id)
        .order('downloaded_at', { ascending: false });

    const t = await getTranslations('Profile');
    const tCommon = await getTranslations('Common');

    return (
        <div className="flex flex-col min-h-screen">
            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex-1">
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

                    <div className="bg-white overflow-hidden shadow rounded-lg p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">{t('credits')}</h2>
                        <div className="flex flex-col h-full justify-center">
                            <div className="flex items-baseline">
                                <span className="text-4xl font-extrabold text-blue-600 mr-2">
                                    {credits?.balance || 0}
                                </span>
                                <span className="text-gray-500">{t('available_credits')}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                                {t('total_earned')}: {credits?.total_earned || 0}
                            </p>
                            <div className="mt-4">
                                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                                    {t('buy_more')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <ProfileContent generatedWraps={generatedWraps || []} downloads={downloads || []} />
            </main>
        </div>
    );
}
