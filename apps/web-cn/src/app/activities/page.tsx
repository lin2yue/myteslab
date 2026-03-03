/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/session';
import { getActivityHubPageDataByActivityId } from '@/lib/activity-hub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
    title: '活动中心 | 特玩',
    description: '查看当前活动内容、累计下载量排行榜，以及作品下载里程碑奖励榜单。',
};

function formatDateTime(value: string) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function formatDate(value: string) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

function formatDateRange(startAt: string, endAt: string) {
    return `${formatDate(startAt)} 至 ${formatDate(endAt)}`;
}

function formatNumber(value: number) {
    return new Intl.NumberFormat('zh-CN').format(value);
}

function getInitial(name: string) {
    return (name.trim().charAt(0) || 'T').toUpperCase();
}

export default async function ActivitiesPage({
    searchParams,
}: {
    searchParams: Promise<{ activityId?: string }>;
}) {
    const { activityId } = await searchParams;
    const user = await getSessionUser();
    const data = await getActivityHubPageDataByActivityId(activityId, user?.id);
    const windowText = data.window ? formatDateRange(data.window.startAt, data.window.endAt) : '当前暂无进行中的活动';
    const milestoneRules = data.creditCampaign?.milestones || [];
    const primaryMilestone = milestoneRules[0] || { milestone_downloads: 10, reward_credits: 10 };
    const statusText = data.hasActiveCampaign ? '进行中' : '暂无活动';

    return (
        <div className="bg-gray-50 dark:bg-zinc-950">
            <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        发布涂装，送积分 赢好礼
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-600 dark:text-zinc-300">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-zinc-800 dark:text-zinc-200">
                            {statusText}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4" />
                            活动时间：{windowText}
                        </span>
                    </div>

                    <div className="mt-4 rounded-xl border border-gray-200 px-4 py-4 dark:border-zinc-800">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">活动详情：</p>
                        <div className="mt-2 space-y-2 text-sm leading-6 text-gray-600 dark:text-zinc-300">
                            <p>
                                活动期间创作并发布涂装作品，如下载量达到
                                {formatNumber(primaryMilestone.milestone_downloads)}
                                用户以上，系统将自动赠送
                                {formatNumber(primaryMilestone.reward_credits)}
                                网站生图积分（可用于生图创作）
                            </p>
                            <p>
                                活动期间，下载量最高的 Top3 创作者（作品累计），将获得Tesla商店精美周边“Tesla Bot 摆件”一件
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pb-10">
                <div className="grid gap-4 xl:grid-cols-2">
                    <div id="user-ranking" className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">作者榜</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                                    活动期内发布作品的累计下载排名
                                </p>
                                {data.currentUserStanding ? (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
                                        我的排名 #{data.currentUserStanding.rank}，{formatNumber(data.currentUserStanding.wrapCount)} 个作品，{formatNumber(data.currentUserStanding.totalDownloads)} 累计下载
                                    </p>
                                ) : null}
                            </div>
                            <div className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 dark:border-zinc-700 dark:text-zinc-300">
                                Top 10
                            </div>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-800">
                            {data.userLeaderboard.length > 0 ? data.userLeaderboard.map((item) => (
                                <div
                                    key={item.userId}
                                    className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 last:border-b-0 dark:border-zinc-800"
                                >
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${item.rank <= 3
                                        ? 'bg-gray-900 text-white dark:bg-white dark:text-zinc-900'
                                        : 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-200'
                                        }`}>
                                        #{item.rank}
                                    </div>

                                    {item.avatarUrl ? (
                                        <img src={item.avatarUrl} alt={item.displayName} className="h-10 w-10 rounded-lg object-cover" />
                                    ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 dark:bg-zinc-800 dark:text-zinc-200">
                                            {getInitial(item.displayName)}
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.displayName}</p>
                                        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                                            {formatNumber(item.wrapCount)} 个作品，{formatNumber(item.totalDownloads)} 累计下载
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <div className="px-4 py-6 text-sm text-gray-500 dark:text-zinc-400">
                                    当前活动窗口内还没有累计下载数据。
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">作品榜</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                                    活动期内发布作品的下载排名
                                </p>
                            </div>
                            <div className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 dark:border-zinc-700 dark:text-zinc-300">
                                实时榜单
                            </div>
                        </div>

                        <div className="mt-4 space-y-3">
                            {data.wrapLeaderboard.length > 0 ? data.wrapLeaderboard.map((item) => {
                                const wrapHref = item.slug ? `/wraps/${item.slug}` : null;
                                return (
                                    <div
                                        key={item.wrapId}
                                        className="rounded-xl border border-gray-200 p-3 dark:border-zinc-800"
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                            <div className="flex min-w-0 items-start gap-3 lg:flex-1">
                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${item.rank <= 3
                                                    ? 'bg-gray-900 text-white dark:bg-white dark:text-zinc-900'
                                                    : 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-200'
                                                    }`}>
                                                    #{item.rank}
                                                </div>

                                                {wrapHref ? (
                                                    <Link href={wrapHref} className="block h-[72px] w-[108px] shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-800">
                                                        {item.previewUrl ? (
                                                            <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-gray-400">暂无预览</div>
                                                        )}
                                                    </Link>
                                                ) : (
                                                    <div className="h-[72px] w-[108px] shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-800">
                                                        {item.previewUrl ? (
                                                            <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-gray-400">暂无预览</div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="min-w-0">
                                                    {wrapHref ? (
                                                        <Link href={wrapHref} className="text-sm font-medium leading-6 text-gray-900 transition-colors hover:text-gray-700 dark:text-white dark:hover:text-zinc-200">
                                                            {item.name}
                                                        </Link>
                                                    ) : (
                                                        <p className="text-sm font-medium leading-6 text-gray-900 dark:text-white">{item.name}</p>
                                                    )}

                                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
                                                        {item.creatorAvatarUrl ? (
                                                            <img src={item.creatorAvatarUrl} alt={item.creatorName} className="h-5 w-5 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-700 dark:bg-zinc-800 dark:text-zinc-200">
                                                                {getInitial(item.creatorName)}
                                                            </div>
                                                        )}
                                                        {item.creatorId ? (
                                                            <Link href={`/creator/${item.creatorId}`} className="font-medium text-gray-700 hover:text-gray-900 dark:text-zinc-300 dark:hover:text-white">
                                                                {item.creatorName}
                                                            </Link>
                                                        ) : (
                                                            <span>{item.creatorName}</span>
                                                        )}
                                                        <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-zinc-600" />
                                                        <span>发布时间 {formatDateTime(item.publishedAt)}</span>
                                                        <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-zinc-600" />
                                                        <span>{formatNumber(item.activityDownloads)} 下载</span>
                                                        {item.milestoneReached ? (
                                                            <>
                                                                <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-zinc-600" />
                                                                <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-700 dark:border-zinc-700 dark:text-zinc-200">
                                                                    积分 +{formatNumber(item.rewardCredits)}
                                                                </span>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                                    当前活动窗口内还没有符合条件的作品进入里程碑榜单。
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {!data.hasActiveCampaign ? (
                    <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-6 py-6 text-center text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                        当前没有进行中的活动，右上角活动入口会在新活动上线后自动出现。
                    </div>
                ) : null}
            </section>
        </div>
    );
}
