'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
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

interface CampaignSummary {
    id: string;
    name: string;
    status: CampaignStatus;
    start_at: string;
    end_at: string;
    milestones: DownloadMilestoneRule[];
    stats: CampaignStats;
}

interface CampaignFormState {
    name: string;
    status: CampaignStatus;
    start_at: string;
    end_at: string;
    milestones: DownloadMilestoneRule[];
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

const DEFAULT_MILESTONES: DownloadMilestoneRule[] = [
    { milestone_downloads: 10, reward_credits: 10 },
];

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

    if (milestoneMap.size === 0) {
        for (const row of DEFAULT_MILESTONES) {
            milestoneMap.set(row.milestone_downloads, row.reward_credits);
        }
    }

    return Array.from(milestoneMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([milestone_downloads, reward_credits]) => ({ milestone_downloads, reward_credits }));
}

function toDatetimeLocalValue(date: Date) {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoString(localDateTime: string): string | null {
    if (!localDateTime) return null;
    const date = new Date(localDateTime);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
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

function getDefaultCampaignForm(): CampaignFormState {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
        name: '',
        status: 'draft',
        start_at: toDatetimeLocalValue(now),
        end_at: toDatetimeLocalValue(nextWeek),
        milestones: [...DEFAULT_MILESTONES],
    };
}

export default function AdminCreditCampaignsPage() {
    const alert = useAlert();

    const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(true);
    const [campaignSaving, setCampaignSaving] = useState(false);
    const [campaignForm, setCampaignForm] = useState<CampaignFormState>(getDefaultCampaignForm());
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [selectedCampaignStats, setSelectedCampaignStats] = useState<CampaignStats>({
        qualified_wraps: 0,
        total_grants: 0,
        total_reward_credits: 0,
    });
    const [rewardRecords, setRewardRecords] = useState<RewardRecord[]>([]);

    const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) || null;

    const fetchCampaigns = useCallback(async () => {
        setCampaignsLoading(true);
        try {
            const res = await fetch('/api/admin/credits/campaigns');
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to load campaigns');
            }
            const campaignRows = Array.isArray(data.campaigns) ? data.campaigns : [];
            const rows: CampaignSummary[] = campaignRows.map((rawRow: unknown) => {
                const row = (rawRow || {}) as Record<string, unknown>;
                const rawStats = (row.stats || {}) as Record<string, unknown>;
                return {
                    id: String(row.id),
                    name: String(row.name || ''),
                    status: String(row.status || 'draft') as CampaignStatus,
                    start_at: String(row.start_at),
                    end_at: String(row.end_at),
                    milestones: normalizeMilestones(row.milestones),
                    stats: {
                        qualified_wraps: Number(rawStats.qualified_wraps || 0),
                        total_grants: Number(rawStats.total_grants || 0),
                        total_reward_credits: Number(rawStats.total_reward_credits || 0),
                    }
                };
            });
            setCampaigns(rows);
            setSelectedCampaignId((prev) => {
                if (prev && rows.some((row) => row.id === prev)) return prev;
                return rows[0]?.id || null;
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load campaigns';
            alert.error(message);
        } finally {
            setCampaignsLoading(false);
        }
    }, [alert]);

    const fetchCampaignDetail = useCallback(async (campaignId: string) => {
        try {
            const res = await fetch(`/api/admin/credits/campaigns/${campaignId}`);
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to load campaign detail');
            }
            setRewardRecords(data.rewardRecords || []);
            setSelectedCampaignStats({
                qualified_wraps: Number(data.campaign?.stats?.qualified_wraps || 0),
                total_grants: Number(data.campaign?.stats?.total_grants || 0),
                total_reward_credits: Number(data.campaign?.stats?.total_reward_credits || 0),
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load campaign detail';
            alert.error(message);
        }
    }, [alert]);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    useEffect(() => {
        if (!selectedCampaignId) {
            setRewardRecords([]);
            setSelectedCampaignStats({ qualified_wraps: 0, total_grants: 0, total_reward_credits: 0 });
            return;
        }
        fetchCampaignDetail(selectedCampaignId);
    }, [fetchCampaignDetail, selectedCampaignId]);

    const createCampaign = async () => {
        const startAtIso = toIsoString(campaignForm.start_at);
        const endAtIso = toIsoString(campaignForm.end_at);
        if (!startAtIso || !endAtIso) {
            alert.error('活动开始时间或结束时间格式无效');
            return;
        }

        setCampaignSaving(true);
        try {
            const payload = {
                name: campaignForm.name.trim(),
                status: campaignForm.status,
                start_at: startAtIso,
                end_at: endAtIso,
                milestones: normalizeMilestones(campaignForm.milestones),
            };
            const res = await fetch('/api/admin/credits/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to create campaign');
            }
            alert.success('活动已创建');
            setCampaignForm(getDefaultCampaignForm());
            await fetchCampaigns();
            if (data.campaign?.id) {
                setSelectedCampaignId(String(data.campaign.id));
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to create campaign';
            alert.error(message);
        } finally {
            setCampaignSaving(false);
        }
    };

    const updateCampaignStatus = async (campaign: CampaignSummary, status: CampaignStatus) => {
        try {
            const res = await fetch(`/api/admin/credits/campaigns/${campaign.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to update campaign');
            }
            alert.success('活动状态已更新');
            await fetchCampaigns();
            if (selectedCampaignId === campaign.id) {
                await fetchCampaignDetail(campaign.id);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to update campaign';
            alert.error(message);
        }
    };

    const updateFormMilestone = (index: number, key: 'milestone_downloads' | 'reward_credits', value: string) => {
        setCampaignForm((prev) => {
            const nextRows = prev.milestones.map((row, rowIndex) => {
                if (rowIndex !== index) return row;
                const parsed = Math.floor(Number(value || 0));
                if (key === 'milestone_downloads') {
                    return { ...row, milestone_downloads: Math.max(1, Number.isFinite(parsed) ? parsed : 1) };
                }
                return { ...row, reward_credits: Math.max(0, Number.isFinite(parsed) ? parsed : 0) };
            });
            return { ...prev, milestones: nextRows };
        });
    };

    const addFormMilestone = () => {
        setCampaignForm((prev) => {
            const last = prev.milestones[prev.milestones.length - 1];
            const nextMilestone = Math.max(1, Number(last?.milestone_downloads || 0) + 10);
            return {
                ...prev,
                milestones: [...prev.milestones, { milestone_downloads: nextMilestone, reward_credits: 10 }],
            };
        });
    };

    const removeFormMilestone = (index: number) => {
        setCampaignForm((prev) => {
            if (prev.milestones.length <= 1) return prev;
            return {
                ...prev,
                milestones: prev.milestones.filter((_, rowIndex) => rowIndex !== index),
            };
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">积分活动</h1>
                    <p className="text-gray-500 text-sm mt-1">创建、管理下载里程碑活动，并查看活动详细数据</p>
                </div>
                <button
                    type="button"
                    onClick={fetchCampaigns}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                >
                    <RotateCcw className={cn('w-4 h-4', campaignsLoading && 'animate-spin')} />
                    刷新活动
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">创建积分活动</h2>
                <div className="space-y-3">
                    <input
                        type="text"
                        value={campaignForm.name}
                        onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                        placeholder="活动名称（例如：春节下载冲榜）"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500">开始时间</label>
                            <input
                                type="datetime-local"
                                value={campaignForm.start_at}
                                onChange={(e) => setCampaignForm({ ...campaignForm, start_at: e.target.value })}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">结束时间</label>
                            <input
                                type="datetime-local"
                                value={campaignForm.end_at}
                                onChange={(e) => setCampaignForm({ ...campaignForm, end_at: e.target.value })}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">活动状态</label>
                        <select
                            value={campaignForm.status}
                            onChange={(e) => setCampaignForm({ ...campaignForm, status: e.target.value as CampaignStatus })}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                        >
                            <option value="draft">草稿</option>
                            <option value="active">立即启用</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs text-gray-500">活动里程碑（可配置多档）</p>
                        {campaignForm.milestones.map((row, index) => (
                            <div key={`campaign-form-milestone-${index}`} className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-gray-500">下载量达到</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={row.milestone_downloads}
                                    onChange={(e) => updateFormMilestone(index, 'milestone_downloads', e.target.value)}
                                    className="w-24 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                                />
                                <span className="text-sm text-gray-500">赠送积分</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={row.reward_credits}
                                    onChange={(e) => updateFormMilestone(index, 'reward_credits', e.target.value)}
                                    className="w-24 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeFormMilestone(index)}
                                    disabled={campaignForm.milestones.length <= 1}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="删除该档位"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addFormMilestone}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                            <Plus className="w-4 h-4" />
                            新增里程碑档位
                        </button>
                    </div>
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        规则：仅统计活动开始时间之后发布的作品，活动窗口内达成里程碑才发放积分。
                    </p>
                    <div>
                        <button
                            onClick={createCampaign}
                            disabled={campaignSaving}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                        >
                            {campaignSaving ? '创建中...' : '创建活动'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
                    <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">积分活动列表</h2>
                </div>
                {campaignsLoading ? (
                    <div className="px-6 py-10 text-sm text-gray-500">活动加载中...</div>
                ) : campaigns.length === 0 ? (
                    <div className="px-6 py-10 text-sm text-gray-500">暂无活动</div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {campaigns.map((campaign) => (
                            <div
                                key={campaign.id}
                                className={cn(
                                    'px-6 py-4 transition-colors',
                                    selectedCampaignId === campaign.id
                                        ? 'bg-blue-50/70 dark:bg-blue-900/10'
                                        : 'hover:bg-gray-50 dark:hover:bg-zinc-800/30'
                                )}
                            >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedCampaignId(campaign.id)}
                                                className="text-sm font-semibold text-left hover:underline"
                                            >
                                                {campaign.name}
                                            </button>
                                            <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', getStatusClassName(campaign.status))}>
                                                {getStatusLabel(campaign.status)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            时间：{format(new Date(campaign.start_at), 'yyyy-MM-dd HH:mm')} ~ {format(new Date(campaign.end_at), 'yyyy-MM-dd HH:mm')}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            里程碑：{campaign.milestones.map((row) => `${row.milestone_downloads}->${row.reward_credits}`).join(' / ')}
                                        </div>
                                        <div className="text-xs text-gray-700">
                                            达标作品 {campaign.stats.qualified_wraps} | 发放次数 {campaign.stats.total_grants} | 发放积分 {campaign.stats.total_reward_credits}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Link
                                            href={`/admin/credit-campaigns/${campaign.id}`}
                                            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                        >
                                            详情
                                        </Link>
                                        {campaign.status !== 'active' && campaign.status !== 'ended' && (
                                            <button
                                                type="button"
                                                onClick={() => updateCampaignStatus(campaign, 'active')}
                                                className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white"
                                            >
                                                启用
                                            </button>
                                        )}
                                        {campaign.status === 'active' && (
                                            <button
                                                type="button"
                                                onClick={() => updateCampaignStatus(campaign, 'paused')}
                                                className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white"
                                            >
                                                暂停
                                            </button>
                                        )}
                                        {campaign.status !== 'ended' && (
                                            <button
                                                type="button"
                                                onClick={() => updateCampaignStatus(campaign, 'ended')}
                                                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-700 text-white"
                                            >
                                                结束
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        积分活动详细数据{selectedCampaign ? `（${selectedCampaign.name}）` : ''}
                    </h2>
                    {selectedCampaign && (
                        <div className="text-xs text-gray-600">
                            达标作品 {selectedCampaignStats.qualified_wraps} | 发放次数 {selectedCampaignStats.total_grants} | 发放积分 {selectedCampaignStats.total_reward_credits}
                        </div>
                    )}
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
        </div>
    );
}
