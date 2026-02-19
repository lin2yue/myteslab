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

type Trend = {
    date: string;
    pv: string;
    uv: string;
};

type TopPage = {
    pathname: string;
    count: string;
};

export default function StatsPage() {
    const [data, setData] = useState<{ summary: StatsSummary; trends: Trend[]; topPages: TopPage[] } | null>(null);
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
        return <div className="p-8 text-center text-zinc-500">正在获取最新情报...</div>;
    }

    if (!data) {
        return <div className="p-8 text-center text-red-500">获取数据失败，请检查数据库连接。</div>;
    }

    const { summary, topPages } = data;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">数据情报局</h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400">实时监控网站流量与用户增长</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card 
                    title="总用户数" 
                    value={summary.total_users} 
                    icon={<Users className="w-5 h-5 text-blue-600" />} 
                    subValue={`今日新增: ${summary.day_registrations}`}
                />
                <Card 
                    title="总浏览量 (PV)" 
                    value={summary.total_pv} 
                    icon={<Eye className="w-5 h-5 text-purple-600" />} 
                    subValue={`今日 PV: ${summary.day_pv}`}
                />
                <Card 
                    title="独立访客 (UV)" 
                    value={summary.total_uv} 
                    icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} 
                    subValue={`今日 UV: ${summary.day_uv}`}
                />
                <Card 
                    title="注册转化率" 
                    value={`${((Number(summary.total_users) / Number(summary.total_uv)) * 100).toFixed(1)}%`} 
                    icon={<UserPlus className="w-5 h-5 text-orange-600" />} 
                    subValue="活跃用户占访客比例"
                />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top Pages List */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <MousePointer2 className="w-5 h-5 text-blue-500" />
                        <h2 className="font-bold text-gray-900 dark:text-white">热门页面排行榜 (Top 10)</h2>
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
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-gradient-to-br from-zinc-900 to-black dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-6 text-white">
                    <BarChart className="w-8 h-8 mb-4 text-blue-400" />
                    <h2 className="text-xl font-bold mb-2">情报分析说明</h2>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                        当前统计数据来自于您的自建数据库。数据记录包括每个请求的路径、用户 ID（如果已登录）、来源渠道以及设备指纹。
                        <br /><br />
                        相对于百度统计，自建方案能更好地穿透广告拦截插件，为您提供最真实的网站负载参考。
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
