import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from '@/lib/i18n';
import ProfileForm from './ProfileForm';
import ProfileContent from './ProfileContent';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';

import CreditsSection from '@/components/profile/CreditsSection';
import Card from '@/components/ui/Card';

interface LedgerRow {
    id: string;
    amount: number;
    type: string;
    description: string | null;
    created_at: string;
    task_id: string | null;
    metadata: Record<string, unknown> | null;
    task_prompt: string | null;
    task_wrap_id: string | null;
    wrap_preview_url: string | null;
    wrap_prompt: string | null;
    balance_after: number | null;
}

interface DownloadRow {
    id: string;
    downloaded_at: string;
    wrap_id: string | null;
    name: string | null;
    preview_url: string | null;
    texture_url: string | null;
}

export const metadata: Metadata = {
    title: 'My Profile - 特玩',
    robots: {
        index: false,
    },
};

export default async function ProfilePage() {
    const user = await getSessionUser();

    if (!user) {
        return redirect('/login?next=/profile');
    }

    // 并行获取所有数据，减少串行等待时间
    const userId = user.id;
    const [profileRes, creditsRes, wrapsRes, downloadsRes, modelsRes, ledgerRes] = await Promise.all([
        dbQuery(`SELECT display_name, avatar_url, email FROM profiles WHERE id = $1`, [userId]),
        dbQuery(`SELECT balance, total_earned FROM user_credits WHERE user_id = $1`, [userId]),
        dbQuery(`SELECT id, name, prompt, slug, texture_url, preview_url, is_public, created_at, model_slug, download_count, user_download_count,
                        COALESCE((
                            SELECT COUNT(*)
                            FROM site_analytics sa
                            WHERE sa.pathname = ('/wraps/' || COALESCE(NULLIF(w.slug, ''), w.id::text))
                        ), 0) AS browse_count
                 FROM wraps w
                 WHERE w.user_id = $1 AND w.deleted_at IS NULL
                 ORDER BY w.created_at DESC
                 LIMIT 24`, [userId]),
        dbQuery(`SELECT d.id, d.downloaded_at, w.id AS wrap_id, w.name, w.preview_url, w.texture_url
                 FROM user_downloads d
                 LEFT JOIN wraps w ON w.id = d.wrap_id
                 WHERE d.user_id = $1
                 ORDER BY d.downloaded_at DESC
                 LIMIT 20`, [userId]),
        dbQuery(`SELECT slug, model_3d_url, wheel_url FROM wrap_models`),
        dbQuery(`WITH ledger AS (
                    SELECT l.id, l.amount, l.type, l.description, l.created_at, l.task_id, l.metadata,
                           t.prompt AS task_prompt,
                           t.wrap_id AS task_wrap_id,
                           w.preview_url AS wrap_preview_url,
                           w.prompt AS wrap_prompt,
                           SUM(l.amount) OVER (
                               PARTITION BY l.user_id
                               ORDER BY l.created_at ASC, l.id ASC
                               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                           )::int AS balance_after
                    FROM credit_ledger l
                    LEFT JOIN generation_tasks t ON t.id = l.task_id
                    LEFT JOIN wraps w ON w.id = t.wrap_id
                    WHERE l.user_id = $1
                 )
                 SELECT *
                 FROM ledger
                 ORDER BY created_at DESC, id DESC
                 LIMIT 100`, [userId])
    ]);

    const profile = profileRes.rows[0];
    const credits = creditsRes.rows[0];
    const generatedWraps = wrapsRes.rows || [];
    const wrapModels = modelsRes.rows || [];
    const pointsHistory = (ledgerRes.rows as LedgerRow[] || []).map((item: LedgerRow) => {
        const prompt = item.task_prompt || item.wrap_prompt || item.description || '';
        return {
            ...item,
            wraps: item.wrap_preview_url
                ? { preview_url: item.wrap_preview_url, prompt }
                : (prompt ? { preview_url: '', prompt } : null)
        };
    });

    const downloads = (downloadsRes.rows as DownloadRow[] || []).map((item: DownloadRow) => ({
        id: item.id,
        downloaded_at: item.downloaded_at,
        wraps: item.wrap_id ? {
            id: item.wrap_id,
            name: item.name,
            preview_url: item.preview_url,
            texture_url: item.texture_url
        } : null
    }));

    const t = await getTranslations('Profile');
    const avatarSeed = profile?.display_name || user?.email || 'U';
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(String(avatarSeed).charAt(0))}&background=random`;

    return (
        <div className="flex flex-col min-h-screen">
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 flex-1 w-full">
                <div className="flex items-center gap-4 mb-8">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-zinc-100">{t('title')}</h1>
                </div>
                {/* User Info & Credits */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <Card className="overflow-hidden p-6">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-4">{t('user_details')}</h2>
                        <div className="flex items-center">
                            <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center text-2xl font-bold text-gray-500 dark:text-zinc-400 mr-4 overflow-hidden">
                                <img
                                    src={profile?.avatar_url || defaultAvatar}
                                    alt={profile?.display_name || user?.email || 'avatar'}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">{t('email')}</p>
                                <p className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{user.email || user.phone || ''}</p>
                                <ProfileForm
                                    initialDisplayName={profile?.display_name || ''}
                                    userId={user.id}
                                />
                            </div>
                        </div>
                    </Card>

                    <CreditsSection
                        balance={credits?.balance || 0}
                        totalEarned={credits?.total_earned || 0}
                        history={pointsHistory}
                    />
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
