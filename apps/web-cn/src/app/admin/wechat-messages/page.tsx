'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Search, RefreshCw, Clock3, Bot, TimerReset } from 'lucide-react';
import { useAlert } from '@/components/alert/AlertProvider';
import { format } from 'date-fns';

type Row = {
    dedup_key: string;
    openid: string;
    msg_type: string;
    msg_id: string | null;
    status: string;
    reply_text: string | null;
    content_hash: string | null;
    created_at: string;
    last_seen_at: string;
};

type Stats = {
    total: number;
    passive_replied: number;
    async_sent: number;
    last_7_days: number;
};

export default function AdminWechatMessagesPage() {
    const alert = useAlert();
    const [items, setItems] = useState<Row[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, passive_replied: 0, async_sent: 0, last_7_days: 0 });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('all');
    const [query, setQuery] = useState('');
    const [input, setInput] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('status', status);
            if (query.trim()) params.set('q', query.trim());
            params.set('limit', '100');
            const res = await fetch(`/api/admin/wechat-messages?${params.toString()}`);
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to load wechat messages');
            }
            setItems(data.items || []);
            setStats(data.stats || { total: 0, passive_replied: 0, async_sent: 0, last_7_days: 0 });
        } catch (err: any) {
            alert.error(err.message || 'Failed to load wechat messages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [status, query]);

    const rows = useMemo(() => items, [items]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <MessageSquare className="w-8 h-8 text-blue-600" />
                        WeChat Auto Replies
                    </h1>
                    <p className="text-gray-500 mt-1">查看公众号自动回复落库记录，方便排查用户咨询和回复情况。</p>
                </div>
                <button
                    onClick={fetchData}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" /> 刷新
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: '总记录', value: stats.total, icon: MessageSquare },
                    { label: '即时回复', value: stats.passive_replied, icon: Bot },
                    { label: '异步发送', value: stats.async_sent, icon: TimerReset },
                    { label: '近 7 天', value: stats.last_7_days, icon: Clock3 },
                ].map((card) => (
                    <div key={card.label} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <card.icon className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-gray-500">{card.label}</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') setQuery(input);
                            }}
                            placeholder="搜 openid / 回复内容 / dedup_key"
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">全部状态</option>
                        <option value="passive_replied">passive_replied</option>
                        <option value="async_sent">async_sent</option>
                    </select>
                    <button
                        onClick={() => setQuery(input)}
                        className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-black transition-colors"
                    >
                        查询
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1100px]">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">时间</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">状态</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">OpenID</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">消息类型</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">回复内容</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">最后命中</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">加载中...</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">没有查到记录</td></tr>
                            ) : rows.map((row) => (
                                <tr key={row.dedup_key} className="border-b border-gray-50 dark:border-zinc-800 align-top">
                                    <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">{format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss')}</td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${row.status === 'async_sent' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-xs text-gray-500 max-w-[180px] break-all">{row.openid}</td>
                                    <td className="px-4 py-4 text-sm text-gray-600">{row.msg_type}</td>
                                    <td className="px-4 py-4 text-sm text-gray-800 dark:text-gray-200 max-w-[520px] whitespace-pre-wrap break-words">{row.reply_text || '-'}</td>
                                    <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">{format(new Date(row.last_seen_at), 'yyyy-MM-dd HH:mm:ss')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
