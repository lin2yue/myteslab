'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Users, Eye, TrendingUp, UserPlus, MousePointer2, CreditCard, Download } from 'lucide-react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

type StatsSummary = {
    total_users: string;
    total_pv: string;
    total_uv: string;
    day_pv: string;
    day_uv: string;
    day_registrations: string;
    total_paying_users: string;
    total_paid_amount: string;
    day_paying_users: string;
    day_paid_amount: string;
    total_wrap_downloads: string;
    total_audio_downloads: string;
    total_downloads: string;
    day_wrap_downloads: string;
    day_audio_downloads: string;
};

type Trend = {
    date: string;
    pv: string;
    uv: string;
    registrations: string;
    paid_amount: string;
    paying_users: string;
    pay_rate: string;
    wrap_downloads: string;
    audio_downloads: string;
    total_downloads: string;
};

type TopPage = {
    pathname: string;
    count: string;
};

type MetricKey = 'pv' | 'uv' | 'registrations' | 'pay_rate' | 'paid_amount' | 'total_downloads';

const cny = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export default function StatsPage() {
    const [data, setData] = useState<{ summary: StatsSummary; trends: Trend[]; topPages: TopPage[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeMetric, setActiveMetric] = useState<MetricKey>('pv');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`/api/admin/stats?_=${Date.now()}`, { cache: 'no-store' });
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

    const { summary, topPages, trends } = data;

    const paidRate = Number(summary.total_users) > 0
        ? ((Number(summary.total_paying_users) / Number(summary.total_users)) * 100).toFixed(2)
        : '0.00';
    const totalDownloads = Number(summary.total_downloads || 0);

    const metricConfig: Record<MetricKey, { title: string; value: string; sub: string }> = {
        pv: {
            title: '总浏览量 (PV)',
            value: summary.total_pv,
            sub: `今日 PV: ${summary.day_pv}`,
        },
        uv: {
            title: '独立访客 (UV)',
            value: summary.total_uv,
            sub: `今日 UV: ${summary.day_uv}`,
        },
        registrations: {
            title: '总用户数',
            value: summary.total_users,
            sub: `今日新增: ${summary.day_registrations}`,
        },
        pay_rate: {
            title: '付费率',
            value: `${paidRate}%`,
            sub: `今日付费用户: ${summary.day_paying_users}`,
        },
        paid_amount: {
            title: '付费金额',
            value: `¥${cny.format(Number(summary.total_paid_amount || 0))}`,
            sub: `今日付费: ¥${cny.format(Number(summary.day_paid_amount || 0))}`,
        },
        total_downloads: {
            title: '总下载量',
            value: String(totalDownloads),
            sub: `今日下载 Wraps ${summary.day_wrap_downloads} / 锁车音 ${summary.day_audio_downloads}`,
        },
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">数据情报局</h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400">实时监控网站流量、增长与付费表现</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                <MetricCard
                    title="总用户数"
                    value={summary.total_users}
                    icon={<Users className="w-5 h-5 text-blue-600" />}
                    subValue={`今日新增: ${summary.day_registrations}`}
                    active={activeMetric === 'registrations'}
                    onClick={() => setActiveMetric('registrations')}
                />
                <MetricCard
                    title="总浏览量 (PV)"
                    value={summary.total_pv}
                    icon={<Eye className="w-5 h-5 text-purple-600" />}
                    subValue={`今日 PV: ${summary.day_pv}`}
                    active={activeMetric === 'pv'}
                    onClick={() => setActiveMetric('pv')}
                />
                <MetricCard
                    title="独立访客 (UV)"
                    value={summary.total_uv}
                    icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                    subValue={`今日 UV: ${summary.day_uv}`}
                    active={activeMetric === 'uv'}
                    onClick={() => setActiveMetric('uv')}
                />
                <MetricCard
                    title="付费率"
                    value={`${paidRate}%`}
                    icon={<UserPlus className="w-5 h-5 text-orange-600" />}
                    subValue={`今日付费用户: ${summary.day_paying_users}`}
                    active={activeMetric === 'pay_rate'}
                    onClick={() => setActiveMetric('pay_rate')}
                />
                <MetricCard
                    title="付费金额"
                    value={`¥${cny.format(Number(summary.total_paid_amount || 0))}`}
                    icon={<CreditCard className="w-5 h-5 text-amber-600" />}
                    subValue={`今日付费: ¥${cny.format(Number(summary.day_paid_amount || 0))}`}
                    active={activeMetric === 'paid_amount'}
                    onClick={() => setActiveMetric('paid_amount')}
                />
                <MetricCard
                    title="总下载量"
                    value={String(totalDownloads)}
                    icon={<Download className="w-5 h-5 text-cyan-600" />}
                    subValue={`今日 Wraps: ${summary.day_wrap_downloads} | 锁车音: ${summary.day_audio_downloads}`}
                    active={activeMetric === 'total_downloads'}
                    onClick={() => setActiveMetric('total_downloads')}
                />
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart className="w-5 h-5 text-blue-500" />
                    <h2 className="font-bold text-gray-900 dark:text-white">{metricConfig[activeMetric].title} 每日趋势</h2>
                </div>
                <TrendLineChart trends={trends} metric={activeMetric} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <MousePointer2 className="w-5 h-5 text-blue-500" />
                        <h2 className="font-bold text-gray-900 dark:text-white">热门页面排行榜 (Top 10)</h2>
                    </div>
                    <div className="space-y-4">
                        {topPages.map((page, idx) => {
                            const href = page.pathname.startsWith('http') ? page.pathname : page.pathname || '/';
                            return (
                                <div key={page.pathname} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[200px] md:max-w-[420px]"
                                        >
                                            {page.pathname}
                                        </a>
                                    </div>
                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">
                                        {page.count} <span className="text-[10px] font-normal opacity-70">hits</span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-zinc-900 to-black dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-6 text-white">
                    <BarChart className="w-8 h-8 mb-4 text-blue-400" />
                    <h2 className="text-xl font-bold mb-2">情报分析说明</h2>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                        付费金额来自充值账本中的真实支付金额字段（Alipay 回调 `total_amount`），不再使用积分数。
                        <br /><br />
                        若历史数据缺少支付金额字段，将在图表中按 0 处理。
                    </p>
                </div>
            </div>
        </div>
    );
}

function MetricCard({
    title,
    value,
    icon,
    subValue,
    active,
    onClick
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
    subValue: string;
    active: boolean;
    onClick?: () => void;
}) {
    const className = `text-left bg-white dark:bg-zinc-900 p-6 rounded-2xl border shadow-sm transition-all ${
        onClick ? 'hover:scale-[1.01]' : ''
    } ${
        active ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/40' : 'border-gray-100 dark:border-zinc-800'
    }`;

    const content = (
        <>
            <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">{title}</span>
                <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-xl">{icon}</div>
            </div>
            <div className="flex flex-baseline gap-2">
                <span className="text-3xl font-black text-gray-900 dark:text-white">{value}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-zinc-500">{subValue}</p>
        </>
    );

    if (!onClick) {
        return <div className={className}>{content}</div>;
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={className}
        >
            {content}
        </button>
    );
}

function TrendLineChart({ trends, metric }: { trends: Trend[]; metric: MetricKey }) {
    const formatAxisDate = (raw: string) => {
        const datePart = String(raw || '').split('T')[0];
        if (datePart.length >= 10) return datePart.slice(5);
        return raw;
    };

    const chartData = useMemo(
        () =>
            trends.map((item) => ({
                date: item.date,
                dateLabel: formatAxisDate(item.date),
                value: Number(item[metric] || 0),
            })),
        [metric, trends]
    );

    const formatValue = (v: number | string) => {
        const value = Number(v || 0);
        if (metric === 'paid_amount') return `¥${cny.format(value)}`;
        if (metric === 'pay_rate') return `${value.toFixed(2)}%`;
        return String(value);
    };

    return (
        <div>
            <div className="w-full h-72 bg-gray-50 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 12, right: 18, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#d4d4d8" />
                        <XAxis
                            dataKey="dateLabel"
                            tick={{ fontSize: 11 }}
                            interval="preserveStartEnd"
                            minTickGap={24}
                        />
                        <YAxis tick={{ fontSize: 11 }} width={64} />
                        <Tooltip
                            formatter={(value: unknown) => formatValue((value as number | string | undefined) ?? 0)}
                            labelFormatter={(_label: unknown, payload: any) => {
                                const rawDate = payload?.[0]?.payload?.date;
                                return `日期: ${String(rawDate || '')}`;
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
