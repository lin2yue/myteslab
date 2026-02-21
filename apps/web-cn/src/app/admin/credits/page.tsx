'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from '@/lib/i18n';
import {
    Download,
    Upload,
    RotateCcw,
    Search,
    ArrowUpCircle,
    ArrowDownCircle,
    UserCircle,
    FileText,
    Filter
} from 'lucide-react';
import { useAlert } from '@/components/alert/AlertProvider';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface CreditLog {
    id: string;
    user_id: string;
    task_id: string | null;
    amount: number;
    type: 'generation' | 'refund' | 'top-up' | 'adjustment';
    description: string;
    created_at: string;
    profiles: {
        display_name: string;
        email: string;
    } | null;
}

interface TopUpUserRow {
    user_id: string;
    total_top_up_credits: number;
    top_up_count: number;
    latest_top_up_at: string;
    profiles: {
        display_name: string;
        email: string;
    } | null;
}

interface CreditRules {
    registration_enabled: boolean;
    registration_credits: number;
    download_reward_enabled: boolean;
    download_threshold: number;
    download_reward_credits: number;
}

interface RewardRecord {
    id: string;
    wrap_id: string;
    user_id: string;
    milestone_downloads: number;
    reward_credits: number;
    created_at: string;
    wrap_name: string | null;
    wrap_prompt: string | null;
    owner_display_name: string | null;
    owner_email: string | null;
}

export default function AdminCreditsPage() {
    const t = useTranslations('Admin');
    const alert = useAlert();
    const [logs, setLogs] = useState<CreditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [topUpSummary, setTopUpSummary] = useState<{ total_top_up_credits: number; top_up_users: number }>({
        total_top_up_credits: 0,
        top_up_users: 0
    });
    const [topUpUsers, setTopUpUsers] = useState<TopUpUserRow[]>([]);
    const [rules, setRules] = useState<CreditRules>({
        registration_enabled: true,
        registration_credits: 30,
        download_reward_enabled: false,
        download_threshold: 100,
        download_reward_credits: 10,
    });
    const [rewardRecords, setRewardRecords] = useState<RewardRecord[]>([]);
    const [rulesLoading, setRulesLoading] = useState(true);
    const [rulesSaving, setRulesSaving] = useState(false);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterType !== 'all') params.set('type', filterType);
            params.set('limit', '100'); // Explicit limit

            const res = await fetch(`/api/admin/credits?${params.toString()}`);
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to load credits');
            }
            setLogs(data.logs || []);
            setTopUpSummary(data.topUpSummary || { total_top_up_credits: 0, top_up_users: 0 });
            setTopUpUsers(data.topUpUsers || []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load credits';
            alert.error(message);
        }
        setLoading(false);
    }, [alert, filterType]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const fetchRules = useCallback(async () => {
        setRulesLoading(true);
        try {
            const res = await fetch('/api/admin/credits/rules');
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to load credit rules');
            }
            if (data.rules) {
                setRules({
                    registration_enabled: Boolean(data.rules.registration_enabled),
                    registration_credits: Number(data.rules.registration_credits || 0),
                    download_reward_enabled: Boolean(data.rules.download_reward_enabled),
                    download_threshold: Number(data.rules.download_threshold || 1),
                    download_reward_credits: Number(data.rules.download_reward_credits || 0),
                });
            }
            setRewardRecords(data.rewardRecords || []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load credit rules';
            alert.error(message);
        } finally {
            setRulesLoading(false);
        }
    }, [alert]);

    const saveRules = async () => {
        setRulesSaving(true);
        try {
            const payload = {
                registration_enabled: rules.registration_enabled,
                registration_credits: Math.max(0, Math.floor(Number(rules.registration_credits || 0))),
                download_reward_enabled: rules.download_reward_enabled,
                download_threshold: Math.max(1, Math.floor(Number(rules.download_threshold || 1))),
                download_reward_credits: Math.max(0, Math.floor(Number(rules.download_reward_credits || 0))),
            };

            const res = await fetch('/api/admin/credits/rules', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to save credit rules');
            }
            alert.success('积分规则已保存');
            await fetchRules();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save credit rules';
            alert.error(message);
        } finally {
            setRulesSaving(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const filteredLogs = logs.filter(log =>
        log.user_id.toLowerCase().includes(search.toLowerCase()) ||
        (log.profiles?.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.profiles?.display_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (log.description || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('credits_title')}</h1>
                    <p className="text-gray-500 text-sm mt-1">{t('credits_desc')}</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shrink-0 w-64"
                        />
                    </div>

                    <div className="relative">
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="appearance-none pl-4 pr-10 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer h-full"
                        >
                            <option value="all">{t('filter_all')}</option>
                            <option value="generation">{t('filter_generation')}</option>
                            <option value="top-up">{t('filter_top_up')}</option>
                            <option value="adjustment">{t('filter_adjustment')}</option>
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    <button
                        onClick={fetchLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                    >
                        <RotateCcw className={cn("w-4 h-4", loading && "animate-spin")} />
                        {t('refresh')}
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">新用户注册赠送积分</h2>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={rules.registration_enabled}
                                onChange={(e) => setRules({ ...rules, registration_enabled: e.target.checked })}
                                className="h-4 w-4"
                            />
                            开启
                        </label>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">初始赠送积分</span>
                        <input
                            type="number"
                            min={0}
                            value={rules.registration_credits}
                            onChange={(e) => setRules({ ...rules, registration_credits: Number(e.target.value || 0) })}
                            className="w-32 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">作品下载里程碑赠送</h2>
                        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={rules.download_reward_enabled}
                                onChange={(e) => setRules({ ...rules, download_reward_enabled: e.target.checked })}
                                className="h-4 w-4"
                            />
                            开启
                        </label>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm text-gray-500">下载量达到</span>
                        <input
                            type="number"
                            min={1}
                            value={rules.download_threshold}
                            onChange={(e) => setRules({ ...rules, download_threshold: Number(e.target.value || 1) })}
                            className="w-28 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                        />
                        <span className="text-sm text-gray-500">赠送积分</span>
                        <input
                            type="number"
                            min={0}
                            value={rules.download_reward_credits}
                            onChange={(e) => setRules({ ...rules, download_reward_credits: Number(e.target.value || 0) })}
                            className="w-28 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={saveRules}
                    disabled={rulesLoading || rulesSaving}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                    {rulesSaving ? '保存中...' : '保存积分规则'}
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm transition-all hover:scale-[1.01]">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                            <Upload className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('lifetime_generated')}</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">
                        {Math.abs(logs.filter(l => l.type === 'generation').reduce((sum, l) => sum + l.amount, 0))}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">From visible ledger entries</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm transition-all hover:scale-[1.01]">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl">
                            <RotateCcw className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('total_refunded')}</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">
                        {logs.filter(l => l.type === 'refund').reduce((sum, l) => sum + l.amount, 0)}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">Returned to users</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm transition-all hover:scale-[1.01]">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl">
                            <Download className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('total_rewarded')}</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">
                        {logs.filter(l => l.type === 'top-up').reduce((sum, l) => sum + l.amount, 0)}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">Initial/Promotion credits</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm transition-all hover:scale-[1.01]">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl">
                            <ArrowUpCircle className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Top-up Users</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900 dark:text-white">
                        {topUpSummary.top_up_users}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                        Credits recharged: {topUpSummary.total_top_up_credits}
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">{t('transaction')}</th>
                            <th className="px-6 py-4">{t('user')}</th>
                            <th className="px-6 py-4">{t('amount')}</th>
                            <th className="px-6 py-4">{t('details')}</th>
                            <th className="px-6 py-4">{t('timestamp')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {loading && logs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">{t('auditing_transactions')}</td>
                            </tr>
                        ) : filteredLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center",
                                            log.type === 'generation' ? "bg-red-50 text-red-500 dark:bg-red-900/20" :
                                                log.type === 'refund' ? "bg-blue-50 text-blue-500 dark:bg-blue-900/20" :
                                                    "bg-green-50 text-green-500 dark:bg-green-900/20"
                                        )}>
                                            {log.type === 'generation' ? <ArrowDownCircle size={18} /> :
                                                log.type === 'refund' ? <RotateCcw size={18} /> :
                                                    <ArrowUpCircle size={18} />}
                                        </div>
                                        <span className="text-sm font-bold capitalize">{log.type}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <UserCircle className="w-4 h-4 text-gray-400" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium truncate max-w-[150px]">{log.profiles?.display_name || 'System'}</span>
                                            <span className="text-[10px] text-gray-400 select-all">{log.user_id.substring(0, 16)}...</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={cn(
                                        "text-sm font-black font-mono",
                                        log.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                    )}>
                                        {log.amount > 0 ? `+${log.amount}` : log.amount}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1 max-w-sm">
                                        <span className="text-xs text-gray-600 dark:text-gray-400 leading-tight">
                                            {log.description}
                                        </span>
                                        {log.task_id && (
                                            <div className="flex items-center gap-1 text-[10px] text-blue-500 font-mono">
                                                <FileText size={10} />
                                                <span className="truncate">Task: {log.task_id}</span>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
                                    {format(new Date(log.created_at), 'yyyy-MM-dd')}
                                    <br />
                                    <span className="text-[10px] opacity-70">{format(new Date(log.created_at), 'HH:mm:ss')}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
                    <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">充值积分用户统计</h2>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-3">User</th>
                            <th className="px-6 py-3">Top-up Credits</th>
                            <th className="px-6 py-3">Top-up Count</th>
                            <th className="px-6 py-3">Last Top-up</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {topUpUsers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-gray-400 italic">No top-up records</td>
                            </tr>
                        ) : topUpUsers.map((row) => (
                            <tr key={row.user_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                                <td className="px-6 py-3">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{row.profiles?.display_name || row.profiles?.email || row.user_id.slice(0, 8)}</span>
                                        <span className="text-[10px] text-gray-400 font-mono">{row.user_id.slice(0, 16)}...</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-sm font-semibold text-amber-700">{row.total_top_up_credits}</td>
                                <td className="px-6 py-3 text-sm">{row.top_up_count}</td>
                                <td className="px-6 py-3 text-xs text-gray-500">{format(new Date(row.latest_top_up_at), 'yyyy-MM-dd HH:mm:ss')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
                    <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">条件赠送积分记录（下载里程碑）</h2>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-3">作品</th>
                            <th className="px-6 py-3">作者</th>
                            <th className="px-6 py-3">里程碑</th>
                            <th className="px-6 py-3">赠送积分</th>
                            <th className="px-6 py-3">时间</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {rewardRecords.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-gray-400 italic">暂无记录</td>
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
