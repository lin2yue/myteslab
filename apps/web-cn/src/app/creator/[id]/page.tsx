import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Download } from 'lucide-react';
import VerifiedCreatorBadge from '@/components/VerifiedCreatorBadge';
import { dbQuery } from '@/lib/db';
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage';

interface CreatorProfile {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    creator_bio: string | null;
    role: string;
}

interface CreatorWrap {
    id: string;
    slug: string | null;
    name: string | null;
    preview_url: string | null;
    price_credits: number;
    download_count: number;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const { rows } = await dbQuery(
        `SELECT display_name FROM profiles WHERE id = $1 AND role = 'creator' LIMIT 1`,
        [id]
    );
    const profile = rows[0];
    if (!profile) {
        return { title: '创作者不存在' };
    }
    return {
        title: `${profile.display_name || '创作者'} - 认证创作者 | 特玩`,
        robots: { index: true },
    };
}

export default async function CreatorProfilePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const [profileRes, wrapsRes] = await Promise.all([
        dbQuery<CreatorProfile>(
            `SELECT id, display_name, avatar_url, creator_bio, role FROM profiles WHERE id = $1 LIMIT 1`,
            [id]
        ),
        dbQuery<CreatorWrap>(
            `SELECT w.id, w.slug, w.name, w.preview_url,
                    COALESCE((to_jsonb(w)->>'price_credits')::int, 0) AS price_credits,
                    COALESCE((to_jsonb(w)->>'download_count')::int, 0) AS download_count
             FROM wraps w
             WHERE w.user_id = $1
               AND w.is_public = true
               AND w.is_active = true
               AND w.deleted_at IS NULL
             ORDER BY COALESCE((to_jsonb(w)->>'download_count')::int, 0) DESC`,
            [id]
        ),
    ]);

    const profile = profileRes.rows[0];
    if (!profile || profile.role !== 'creator') {
        notFound();
    }

    const wraps = wrapsRes.rows;
    const totalDownloads = wraps.reduce((sum, w) => sum + Number(w.download_count || 0), 0);

    const avatarSeed = profile.display_name || 'C';
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarSeed.charAt(0))}&background=random`;

    return (
        <div className="flex flex-col min-h-screen">
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 flex-1 w-full">

                {/* 头部区域 */}
                <div className="flex flex-col items-center text-center mb-12">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-zinc-800 shadow-lg mb-4">
                        <Image
                            src={profile.avatar_url || defaultAvatar}
                            alt={profile.display_name || '创作者'}
                            width={96}
                            height={96}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100">
                            {profile.display_name || '匿名创作者'}
                        </h1>
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                            <VerifiedCreatorBadge size={14} />
                            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">认证创作者</span>
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mb-4 leading-relaxed">
                        {profile.creator_bio || '这位创作者很神秘～'}
                    </p>

                    <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-zinc-400">
                        <span className="font-semibold text-gray-900 dark:text-zinc-100">{wraps.length}</span>
                        <span>件作品</span>
                        <span className="w-px h-4 bg-gray-200 dark:bg-zinc-700" />
                        <span className="font-semibold text-gray-900 dark:text-zinc-100">{totalDownloads}</span>
                        <span>次下载</span>
                    </div>
                </div>

                {/* 作品网格 */}
                {wraps.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {wraps.map((wrap) => {
                            const wrapSlug = wrap.slug || wrap.id;
                            return (
                                <Link key={wrap.id} href={`/wraps/${wrapSlug}`}>
                                    <div className="bg-white/80 dark:bg-zinc-900/80 rounded-2xl overflow-hidden border border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/15 hover:-translate-y-0.5 transition-all duration-300 group">
                                        <div className="aspect-[4/3] relative overflow-hidden bg-gray-50 dark:bg-zinc-800">
                                            {wrap.preview_url ? (
                                                <ResponsiveOSSImage
                                                    src={wrap.preview_url}
                                                    alt={wrap.name || '作品预览'}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-zinc-600 text-xs font-bold">
                                                    NO IMG
                                                </div>
                                            )}
                                            {/* 价格 badge */}
                                            <div className="absolute top-2 right-2">
                                                {wrap.price_credits > 0 ? (
                                                    <span className="px-2 py-0.5 bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-full">
                                                        {wrap.price_credits} 积分
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-green-500/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-full">
                                                        免费
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 line-clamp-1 mb-1">
                                                {wrap.name || '未命名作品'}
                                            </p>
                                            <div className="flex items-center gap-1 text-gray-400 dark:text-zinc-500">
                                                <Download className="w-3 h-3" />
                                                <span className="text-[11px] font-medium">{wrap.download_count}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-24 text-gray-400 dark:text-zinc-500 font-medium text-sm">
                        该创作者暂无公开作品
                    </div>
                )}
            </main>
        </div>
    );
}
