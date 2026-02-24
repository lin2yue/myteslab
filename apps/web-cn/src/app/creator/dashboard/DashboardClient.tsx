'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Zap, TrendingUp, Package, Download } from 'lucide-react';
import Card from '@/components/ui/Card';

interface TrendDay {
    day: string;
    cnt: number;
    credits: number;
}

interface WrapEarning {
    name: string | null;
    download_count: number;
    creator_earnings: number;
    price_credits: number;
}

interface DashboardClientProps {
    monthlyEarning: number;
    totalEarning: number;
    publishedCount: number;
    totalDownloads: number;
    trendData: TrendDay[];
    topWraps: WrapEarning[];
}

export default function DashboardClient({
    monthlyEarning,
    totalEarning,
    publishedCount,
    totalDownloads,
    trendData,
    topWraps,
}: DashboardClientProps) {
    const stats = [
        {
            label: '本月收益积分',
            value: monthlyEarning,
            icon: <Zap className="w-5 h-5 text-amber-500" />,
            color: 'text-amber-600 dark:text-amber-400',
        },
        {
            label: '总收益积分',
            value: totalEarning,
            icon: <TrendingUp className="w-5 h-5 text-green-500" />,
            color: 'text-green-600 dark:text-green-400',
        },
        {
            label: '已发布作品数',
            value: publishedCount,
            icon: <Package className="w-5 h-5 text-blue-500" />,
            color: 'text-blue-600 dark:text-blue-400',
        },
        {
            label: '总下载次数',
            value: totalDownloads,
            icon: <Download className="w-5 h-5 text-purple-500" />,
            color: 'text-purple-600 dark:text-purple-400',
        },
    ];

    return (
        <div className="space-y-8">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <Card key={stat.label} className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center">
                                {stat.icon}
                            </div>
                            <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">{stat.label}</span>
                        </div>
                        <p className={`text-2xl font-black ${stat.color}`}>{stat.value.toLocaleString()}</p>
                    </Card>
                ))}
            </div>

            {/* 近30天下载趋势 */}
            <Card className="p-6">
                <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-6">近30天下载趋势</h3>
                {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis
                                dataKey="day"
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickFormatter={(v: string) => v.slice(5)}
                            />
                            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(24,24,27,0.9)',
                                    border: 'none',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    color: '#fff'
                                }}
                                labelFormatter={(v) => `日期：${String(v)}`}
                                formatter={(value, name) => [(value ?? 0) as number, (name as string) === 'cnt' ? '下载量' : '获得积分']}
                            />
                            <Line
                                type="monotone"
                                dataKey="cnt"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-[220px] flex items-center justify-center text-gray-400 dark:text-zinc-500 text-sm">
                        暂无下载数据
                    </div>
                )}
            </Card>

            {/* 作品收益排行 */}
            <Card className="p-6">
                <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-4">作品收益排行</h3>
                {topWraps.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-black/5 dark:border-white/10">
                                    <th className="text-left pb-3 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">作品名</th>
                                    <th className="text-right pb-3 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">定价</th>
                                    <th className="text-right pb-3 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">下载次数</th>
                                    <th className="text-right pb-3 text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">获得积分</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                {topWraps.map((wrap, i) => (
                                    <tr key={i} className="hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
                                        <td className="py-3 pr-4 font-medium text-gray-900 dark:text-zinc-100 max-w-[200px] truncate">
                                            {wrap.name || '未命名'}
                                        </td>
                                        <td className="py-3 text-right">
                                            {wrap.price_credits > 0 ? (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full">
                                                    {wrap.price_credits} 积分
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">
                                                    免费
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 text-right font-semibold text-gray-700 dark:text-zinc-300">
                                            {wrap.download_count}
                                        </td>
                                        <td className="py-3 text-right font-bold text-amber-600 dark:text-amber-400">
                                            {wrap.creator_earnings}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-12 text-center text-gray-400 dark:text-zinc-500 text-sm">
                        暂无作品数据
                    </div>
                )}
            </Card>

            {/* 积分兑换入口 */}
            <div className="flex flex-col items-center py-8">
                <button
                    disabled
                    className="h-12 px-8 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 font-bold text-sm cursor-not-allowed"
                >
                    积分兑换
                </button>
                <p className="mt-2 text-xs text-gray-400 dark:text-zinc-500">敬请期待</p>
            </div>
        </div>
    );
}
