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
    const { data: generatedWraps } = await supabase
        .from('generated_wraps')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    // Fetch Downloads (Join with wraps table)
    const { data: downloads } = await supabase
        .from('user_downloads')
        .select('*, wraps(*)')
        .eq('user_id', user.id)
        .order('downloaded_at', { ascending: false });

    const t = await getTranslations('Profile');
    const tCommon = await getTranslations('Common');

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="text-xl font-bold text-gray-900">
                            MyTesLab
                        </Link>

                        <nav className="hidden md:flex items-center gap-6">
                            <Link
                                href="/"
                                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                            >
                                {tCommon('nav.gallery')}
                            </Link>
                            <Link
                                href="/ai-generate/generate"
                                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                            >
                                {tCommon('nav.ai_generator')}
                            </Link>
                        </nav>

                        <h1 className="text-2xl font-bold text-gray-900 border-l border-gray-200 pl-8">{t('title')}</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex md:hidden items-center gap-4 mr-2">
                            <Link href="/" className="text-xs font-medium text-gray-500">{tCommon('nav.gallery')}</Link>
                            <Link href="/ai-generate/generate" className="text-xs font-medium text-gray-500">{tCommon('nav.ai_generator')}</Link>
                        </div>
                        <AuthButton />
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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
