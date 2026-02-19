'use client';

import React, { useEffect, useState } from 'react';
import { BarChart, Users, Eye, TrendingUp, UserPlus, MousePointer2 } from 'lucide-react';

type StatsSummary = {
    total_users: string;
    total_pv: string;
    total_uv: string;
    day_pv: string;
    day_uv: string;
    day_registrations: string;
};

type TopPage = {
    pathname: string;
    count: string;
};

export default function StatsPage() {
    const [data, setData] = useState<{ summary: StatsSummary; topPages: TopPage[] } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/admin/stats');
                const json = await res.json();
                setData(json);
            } catch (e) {
                console.error('Fetch stats error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-zinc-500">Fetching intelligence...</div>;
    }

    if (!data) {
        return <div className="p-8 text-center text-red-500">Failed to fetch data.</div>;
    }

    const { summary, topPages } = data;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Intelligence Bureau</h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400">Real-time monitoring of traffic and growth</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card 
                    title="Total Users" 
                    value={summary.total_users} 
                    icon={<Users className="w-5 h-5 text-blue-600" />} 
                    subValue={`Today: ${summary.day_registrations}`}
                />
                <Card 
                    title="PV (All Time)" 
                    value={summary.total_pv} 
                    icon={<Eye className="w-5 h-5 text-purple-600" />} 
                    subValue={`Today: ${summary.day_pv}`}
                />
                <Card 
                    title="UV (All Time)" 
                    value={summary.total_uv} 
                    icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} 
                    subValue={`Today: ${summary.day_uv}`}
                />
                <Card 
                    title="Conv. Rate" 
                    value="N/A" 
                    icon={<UserPlus className="w-5 h-5 text-orange-600" />} 
                    subValue="Users vs Visitors"
                />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <MousePointer2 className="w-5 h-5 text-blue-500" />
                        <h2 className="font-bold text-gray-900 dark:text-white">Top Pages (Global)</h2>
                    </div>
                    <div className="space-y-4">
                        {topPages.map((page, idx) => (
                            <div key={page.pathname} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                                    <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 truncate max-w-[200px] md:max-w-[400px]">
                                        {page.pathname}
                                    </span>
                                </div>
                                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
                                    {page.count} <span className="text-[10px] font-normal opacity-70">hits</span>
                                </span>
                            </div>
                        ))}
                        {topPages.length === 0 && <p className="text-center text-zinc-500 text-sm">No data yet.</p>}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-zinc-900 to-black dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-6 text-white">
                    <BarChart className="w-8 h-8 mb-4 text-blue-400" />
                    <h2 className="text-xl font-bold mb-2">Analysis Note</h2>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                        This data is fetched directly from your Supabase instance.
                        <br /><br />
                        For detailed trends and UV calculation, specific Database Functions (RPC) must be enabled in your Supabase SQL Editor.
                    </p>
                </div>
            </div>
        </div>
    );
}

function Card({ title, value, icon, subValue }: { title: string, value: string, icon: React.ReactNode, subValue: string }) {
    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{title}</span>
                <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-xl">
                    {icon}
                </div>
            </div>
            <div className="flex flex-baseline gap-2">
                <span className="text-3xl font-black text-gray-900 dark:text-white">{value}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-zinc-500">{subValue}</p>
        </div>
    );
}
