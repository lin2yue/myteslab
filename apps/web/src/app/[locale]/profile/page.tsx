import { createClient } from '@/utils/supabase/server';
import { redirect } from '@/i18n/routing';
import AuthButton from '@/components/auth/AuthButton';
import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';

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
        .order('created_at', { ascending: false });

    // Fetch Downloads (Join with wraps table)
    const { data: downloads } = await supabase
        .from('user_downloads')
        .select('*, wraps(*)')
        .eq('user_id', user.id)
        .order('downloaded_at', { ascending: false });

    const t = await getTranslations('Profile');

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center">
                        <Link href="/" className="text-xl font-bold text-gray-900 mr-8">
                            MyTesLab
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
                    </div>
                    <AuthButton />
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
                                <p className="text-sm font-medium text-gray-500 mt-2">{t('display_name')}</p>
                                <p className="text-lg font-semibold text-gray-900">{profile?.display_name || 'N/A'}</p>
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

                {/* Generated Wraps */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">{t('generated_wraps')}</h2>
                    {generatedWraps && generatedWraps.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {generatedWraps.map((wrap) => (
                                <div key={wrap.id} className="relative group bg-white rounded-lg shadow overflow-hidden aspect-square">
                                    <img
                                        src={wrap.preview_url || wrap.texture_url}
                                        alt={wrap.prompt || 'Generated Wrap'}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-xs truncate">
                                        {wrap.prompt}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                            {t('no_generated_wraps')}
                        </div>
                    )}
                </div>

                {/* Download History */}
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">{t('download_history')}</h2>
                    {downloads && downloads.length > 0 ? (
                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                            <ul className="divide-y divide-gray-200">
                                {downloads.map((item) => (
                                    <li key={item.id}>
                                        <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                                            <div className="flex items-center">
                                                {item.wraps?.preview_url && (
                                                    <img src={item.wraps.preview_url} alt={item.wraps.name} className="h-10 w-10 rounded mr-4" />
                                                )}
                                                <div className="text-sm font-medium text-blue-600 truncate">
                                                    {item.wraps?.name || 'Unknown Wrap'}
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <p className="text-sm text-gray-500">
                                                    {new Date(item.downloaded_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                            {t('no_downloads')}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
