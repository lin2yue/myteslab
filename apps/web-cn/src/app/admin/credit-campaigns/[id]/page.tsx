'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useAlert } from '@/components/alert/AlertProvider';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type CampaignStatus = 'draft' | 'active' | 'paused' | 'ended';

interface DownloadMilestoneRule {
    milestone_downloads: number;
    reward_credits: number;
}

interface CampaignStats {
    qualified_wraps: number;
    total_grants: number;
    total_reward_credits: number;
}

interface CampaignDetail {
    id: string;
    name: string;
    status: CampaignStatus;
    start_at: string;
    end_at: string;
    milestones: DownloadMilestoneRule[];
    stats: CampaignStats;
}

interface RewardRecord {
    id: string;
    campaign_id: string;
    wrap_id: string;
    user_id: string;
    milestone_downloads: number;
    metric_value: number;
    reward_credits: number;
    created_at: string;
    wrap_name: string | null;
    wrap_prompt: string | null;
    owner_display_name: string | null;
    owner_email: string | null;
}

function getStatusLabel(status: CampaignStatus) {
    if (status === 'active') return '进行中';
    if (status === 'paused') return '暂停';
    if (status === 'ended') return '已结束';
    return '草稿';
}

function getStatusClassName(status: CampaignStatus) {
    if (status === 'active') return 'bg-emerald-100 text-emerald-700';
    if (status === 'paused') return 'bg-amber-100 text-amber-700';
    if (status === 'ended') return 'bg-zinc-200 text-zinc-700';
    return 'bg-blue-100 text-blue-700';
}

function normalizeMilestones(raw: unknown): DownloadMilestoneRule[] {
    const milestoneMap = new Map<number, number>();
    if (Array.isArray(raw)) {
        for (const item of raw) {
            const milestone = Math.floor(Number((item as { milestone_downloads?: unknown })?.milestone_downloads));
            const rewardCredits = Math.floor(Number((item as { reward_credits?: unknown })?.reward_credits));
            if (!Number.isFinite(milestone) || milestone < 1) continue;
            if (!Number.isFinite(rewardCredits) || rewardCredits < 0) continue;
            milestoneMap.set(milestone, rewardCredits);
        }
    }

    return Array.from(milestoneMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([milestone_downloads, reward_credits]) => ({ milestone_downloads, reward_credits }));
}

export default function AdminCreditCampaignDetailPage() {
    const params = useParams<{ id: string }>();
    const campaignId = params?.id;
    const alert = useAlert();

    const [loading, setLoading] = useState(true);
    const [statusSaving, setStatusSaving] = useState(false);
    const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
    const [rewardRecords, setRewardRecords] = useState<RewardRecord[]>([]);

    const fetchCampaignDetail = useCallback(async () => {
        if (!campaignId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/credits/campaigns/${campaignId}`);
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to load campaign detail');
            }

            const rawCampaign = (data.campaign || {}) as Record<string, unknown>;
            const rawStats = (rawCampaign.stats || {}) as Record<string, unknown>;
            setCampaign({
                id: String(rawCampaign.id || ''),
                name: String(rawCampaign.name || ''),
                status: String(rawCampaign.status || 'draft') as CampaignStatus,
                start_at: String(rawCampaign.start_at || ''),
                end_at: String(rawCampaign.end_at || ''),
                milestones: normalizeMilestones(rawCampaign.milestones),
                stats: {
                    qualified_wraps: Number(rawStats.qualified_wraps || 0),
                    total_grants: Number(rawStats.total_grants || 0),
                    total_reward_credits: Number(rawStats.total_reward_credits || 0),
                },
            });
            setRewardRecords(Array.isArray(data.rewardRecords) ? data.rewardRecords : []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load campaign detail';
            alert.error(message);
            setCampaign(null);
            setRewardRecords([]);
        } finally {
            setLoading(false);
        }
    }, [alert, campaignId]);

    useEffect(() => {
        fetchCampaignDetail();
    }, [fetchCampaignDetail]);

    const updateCampaignStatus = async (status: CampaignStatus) => {
        if (!campaignId) return;
        setStatusSaving(true);
        try {
            const res = await fetch(`/api/admin/credits/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to update campaign');
            }
            alert.success('活动状态已更新');
            await fetchCampaignDetail();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to update campaign';
            alert.error(message);
        } finally {
            setStatusSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <Link
                        href="/admin/credit-campaigns"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        返回积分活动列表
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {campaign?.name || '积分活动详情'}
                    </h1>
                    {campaign && (
                        <p className="text-gray-500 text-sm mt-1">
                            活动时间：{format(new Date(campaign.start_at), 'yyyy-MM-dd HH:mm')} ~ {format(new Date(campaign.end_at), 'yyyy-MM-dd HH:mm')}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={fetchCampaignDetail}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors shadow-sm disabled:opacity-50"
                >
                    <RotateCcw className={cn('w-4 h-4', loading && 'animate-spin')} />
                    刷新
                </button>
            </div>

            {loading && !campaign ? (
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-gray-200 dark:border-zinc-800 text-sm text-gray-500">
                    活动加载中...
                </div>
            ) : !campaign ? (
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-gray-200 dark:border-zinc-800 text-sm text-gray-500">
                    活动不存在或无权限查看
                </div>
            ) : (
                <>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm space-y-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-2">
                                <span className={cn('text-xs px-2 py-1 rounded-full font-medium', getStatusClassName(campaign.status))}>
                                    {getStatusLabel(campaign.status)}
                                </span>
                                <span className="text-xs text-gray-500">
                                    里程碑：{campaign.milestones.map((row) => `${row.milestone_downloads}->${row.reward_credits}`).join(' / ')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {campaign.status !== 'active' && campaign.status !== 'ended' && (
                                    <button
                                        type="button"
                                        onClick={() => updateCampaignStatus('active')}
                                        disabled={statusSaving}
                                        className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                                    >
                                        启用
                                    </button>
                                )}
                                {campaign.status === 'active' && (
                                    <button
                                        type="button"
                                        onClick={() => updateCampaignStatus('paused')}
                                        disabled={statusSaving}
                                        className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white disabled:opacity-50"
                                    >
                                        暂停
                                    </button>
                                )}
                                {campaign.status !== 'ended' && (
                                    <button
                                        type="button"
                                        onClick={() => updateCampaignStatus('ended')}
                                        disabled={statusSaving}
                                        className="px-3 py-1.5 text-xs rounded-lg bg-zinc-700 text-white disabled:opacity-50"
                                    >
                                        结束
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 px-4 py-3">
                                <p className="text-xs text-gray-500">达标作品</p>
                                <p className="text-xl font-bold mt-1">{campaign.stats.qualified_wraps}</p>
                            </div>
                            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 px-4 py-3">
                                <p className="text-xs text-gray-500">发放次数</p>
                                <p className="text-xl font-bold mt-1">{campaign.stats.total_grants}</p>
                            </div>
                            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 px-4 py-3">
                                <p className="text-xs text-gray-500">发放积分</p>
                                <p className="text-xl font-bold mt-1">{campaign.stats.total_reward_credits}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
                            <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">发奖记录</h2>
                        </div>
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-3">作品</th>
                                    <th className="px-6 py-3">作者</th>
                                    <th className="px-6 py-3">里程碑</th>
                                    <th className="px-6 py-3">活动内下载量</th>
                                    <th className="px-6 py-3">赠送积分</th>
                                    <th className="px-6 py-3">时间</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {rewardRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400 italic">暂无记录</td>
                                    </tr>
                                ) : rewardRecords.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{row.wrap_name || row.wrap_prompt || row.wrap_id.slice(0, 8)}</span>
                                                <span className="text-[10px] text-gray-400 font-mono">{row.wrap_id.slice(0, 16)}...</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm">{row.owner_display_name || row.owner_email || row.user_id.slice(0, 8)}</span>
                                                <span className="text-[10px] text-gray-400 font-mono">{row.user_id.slice(0, 16)}...</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-sm">{row.milestone_downloads}</td>
                                        <td className="px-6 py-3 text-sm">{row.metric_value}</td>
                                        <td className="px-6 py-3 text-sm font-semibold text-emerald-700">+{row.reward_credits}</td>
                                        <td className="px-6 py-3 text-xs text-gray-500">{format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
