'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircleMore, RefreshCw, Search, Inbox, Send, Clock3 } from 'lucide-react';
import { useAlert } from '@/components/alert/AlertProvider';
import { format } from 'date-fns';

type Row = {
    id: number;
    source_account: string;
    openid: string;
    direction: 'inbound' | 'outbound';
    msg_type: string;
    event: string | null;
    event_key: string | null;
    msg_id: string | null;
    dedup_key: string | null;
    content: string | null;
    reply_strategy: string | null;
    created_at: string;
};

type Stats = {
    total: number;
    inbound_count: number;
    outbound_count: number;
    last_7_days: number;
};

export default function AdminTewanMpMessagesPage() {
    const alert = useAlert();
    const [items, setItems] = useState<Row[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, inbound_count: 0, outbound_count: 0, last_7_days: 0 });
    const [loading, setLoading] = useState(true);
    const [direction, setDirection] = useState('all');
    const [input, setInput] = useState('');
    const [query, setQuery] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('direction', direction);
            if (query.trim()) params.set('q', query.trim());
            params.set('limit', '100');
            const res = await fetch(`/api/admin/tewan-mp-messages?${params.toString()}`);
            const data = await res.json();
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load tewan mp messages');
            setItems(data.items || []);
            setStats(data.stats || { total: 0, inbound_count: 0, outbound_count: 0, last_7_days: 0 });
        } catch (err: any) {
            alert.error(err.message || 'Failed to load tewan mp messages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [direction, query]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <MessageCircleMore className="w-8 h-8 text-blue-600" />
                        Tewan MP Messages
                    </h1>
                    <p className="text-gray-500 mt-1">专门查看“特玩公众号”的用户消息与自动回复记录，不再和服务号混在一起。</p>
                </div>
                <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
                    <RefreshCw className="w-4 h-4" /> 刷新
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: '总记录', value: stats.total, icon: MessageCircleMore },
                    { label: '用户消息', value: stats.inbound_count, icon: Inbox },
                    { label: '自动回复', value: stats.outbound_count, icon: Send },
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
                            onKeyDown={(e) => e.key === 'Enter' && setQuery(input)}
                            placeholder="搜 openid / 内容 / reply_strategy"
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <select value={direction} onChange={(e) => setDirection(e.target.value)} className="px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="all">全部方向</option>
                        <option value="inbound">inbound</option>
                        <option value="outbound">outbound</option>
                    </select>
                    <button onClick={() => setQuery(input)} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-black transition-colors">查询</button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1200px]">
                        <thead>
                            <tr className="bg-gray-50/80 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">时间</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">方向</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">OpenID</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">消息类型</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">事件</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">回复策略</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">内容</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">加载中...</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">还没有记录</td></tr>
                            ) : items.map((row) => (
                                <tr key={row.id} className="border-b border-gray-50 dark:border-zinc-800 align-top">
                                    <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">{format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss')}</td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${row.direction === 'inbound' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{row.direction}</span>
                                    </td>
                                    <td className="px-4 py-4 text-xs text-gray-500 max-w-[180px] break-all">{row.openid}</td>
                                    <td className="px-4 py-4 text-sm text-gray-600">{row.msg_type}</td>
                                    <td className="px-4 py-4 text-xs text-gray-500">{row.event || row.event_key || '-'}</td>
                                    <td className="px-4 py-4 text-xs text-gray-500">{row.reply_strategy || '-'}</td>
                                    <td className="px-4 py-4 text-sm text-gray-800 dark:text-gray-200 max-w-[520px] whitespace-pre-wrap break-words">{row.content || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
