'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    Clock,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    User,
    Zap,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Wallet
} from 'lucide-react';
import { useAlert } from '@/components/alert/AlertProvider';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface TaskStep {
    step: string;
    ts: string;
    reason?: string;
}

interface GenerationTask {
    id: string;
    user_id: string;
    prompt: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'failed_refunded';
    credits_spent: number;
    error_message: string | null;
    steps: TaskStep[];
    created_at: string;
    profiles: {
        display_name: string;
        email: string;
    } | null;
}

export default function AdminTasksPage() {
    const t = useTranslations('Admin');
    const alert = useAlert();
    const [tasks, setTasks] = useState<GenerationTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [refundingId, setRefundingId] = useState<string | null>(null);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/tasks');
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to load tasks');
            }
            setTasks(data.tasks || []);
        } catch (err: any) {
            alert.error(err.message || 'Failed to load tasks');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTasks();
        const timer = setInterval(fetchTasks, 15000);
        return () => clearInterval(timer);
    }, []);

    const handleRefund = async (taskId: string) => {
        if (!confirm(t('refund_confirm'))) return;

        setRefundingId(taskId);
        try {
            const res = await fetch('/api/admin/tasks/refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, reason: 'Manual admin refund' })
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || t('refund_failed'));
            }
            alert.success(t('refund_success'));
            fetchTasks();
        } catch (err: any) {
            alert.error(err.message || t('refund_failed'));
        }
        setRefundingId(null);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <span className="px-2 py-1 flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 size={12} /> {t('status_success')}
                </span>;
            case 'failed':
                return <span className="px-2 py-1 flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 rounded-full dark:bg-red-900/30 dark:text-red-400">
                    <AlertCircle size={12} /> {t('status_failed')}
                </span>;
            case 'failed_refunded':
                return <span className="px-2 py-1 flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full dark:bg-blue-900/30 dark:text-blue-400">
                    <Zap size={12} /> {t('status_refunded')}
                </span>;
            case 'processing':
                return <span className="px-2 py-1 flex items-center gap-1 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded-full dark:bg-yellow-900/30 dark:text-yellow-400 animate-pulse">
                    <Clock size={12} /> {t('status_processing')}
                </span>;
            default:
                return <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-700 rounded-full dark:bg-zinc-800 dark:text-gray-400">
                    {status}
                </span>;
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <Zap className="w-8 h-8 text-blue-600" />
                        AI Generation Tasks
                    </h1>
                    <p className="text-gray-500 mt-1">Monitor and manage all AI-powered wrap generation requests.</p>
                </div>
                <button
                    onClick={fetchTasks}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <RotateCcw className={cn("w-4 h-4", loading && "animate-spin")} />
                    {t('refresh')}
                </button>
            </div>

            {/* Stats (Inline for Tasks) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Pending', count: tasks.filter(t => t.status === 'pending' || t.status === 'processing').length, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                    { label: 'Completed', count: tasks.filter(t => t.status === 'completed').length, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Failed', count: tasks.filter(t => t.status === 'failed').length, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Refunded', count: tasks.filter(t => t.status === 'failed_refunded').length, color: 'text-blue-600', bg: 'bg-blue-50' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{stat.label}</span>
                            <div className={cn("w-2 h-2 rounded-full animate-pulse", stat.bg.replace('bg-', 'text-').replace('-50', '-500'))} style={{ backgroundColor: 'currentColor' }} />
                        </div>
                        <p className={cn("text-2xl font-black", stat.color)}>{stat.count}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">User</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Prompt Preview</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Cost</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Time</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                            {loading && tasks.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">Connecting to task stream...</td>
                                </tr>
                            ) : tasks.map((task) => (
                                <React.Fragment key={task.id}>
                                    <tr
                                        onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                        className={cn(
                                            "hover:bg-gray-50/50 dark:hover:bg-zinc-800/20 transition-colors group cursor-pointer relative",
                                            expandedTaskId === task.id && "bg-blue-50/20 dark:bg-blue-900/5"
                                        )}
                                    >
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            {getStatusBadge(task.status)}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                                                    {task.profiles?.display_name || 'Anonymous User'}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1 uppercase tracking-tighter">
                                                    ID: {task.user_id.substring(0, 8)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 min-w-[300px]">
                                            <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 italic font-medium leading-relaxed">
                                                "{task.prompt}"
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs font-bold">
                                                <Wallet size={12} />
                                                {task.credits_spent}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex flex-col text-right md:text-left">
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                    {format(new Date(task.created_at), 'HH:mm:ss')}
                                                </span>
                                                <span className="text-[10px] text-gray-400 uppercase font-black">
                                                    {format(new Date(task.created_at), 'MMM dd')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                {task.status === 'failed' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRefund(task.id); }}
                                                        disabled={refundingId === task.id}
                                                        className="p-2 border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all disabled:opacity-50 shadow-sm"
                                                        title={t('refund_btn')}
                                                    >
                                                        <RotateCcw className={cn("w-4 h-4", refundingId === task.id && "animate-spin")} />
                                                    </button>
                                                )}
                                                <div className={cn(
                                                    "p-2 text-gray-400 group-hover:text-blue-500 transition-all",
                                                    expandedTaskId === task.id && "text-blue-600 rotate-180"
                                                )}>
                                                    <ChevronDown size={20} />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Detail View */}
                                    {expandedTaskId === task.id && (
                                        <tr>
                                            <td colSpan={6} className="p-0 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/30">
                                                <div className="px-8 py-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                                        {/* Pipeline Tracking */}
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-6">
                                                                <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                                                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">{t('steps_title')}</h4>
                                                            </div>
                                                            <div className="space-y-0 ml-3">
                                                                {Array.isArray(task.steps) && task.steps.length > 0 ? (
                                                                    task.steps.map((step, idx) => (
                                                                        <div key={idx} className="flex gap-6 items-start relative pb-8 group/step">
                                                                            {idx < task.steps.length - 1 && (
                                                                                <div className="absolute left-[7px] top-6 bottom-0 w-[2.5px] bg-gradient-to-b from-blue-500/50 to-transparent" />
                                                                            )}
                                                                            <div className={cn(
                                                                                "w-4 h-4 rounded-full mt-1 shrink-0 z-10 border-4 border-white dark:border-zinc-900 shadow-sm",
                                                                                step.step === 'refunded' ? "bg-blue-500" :
                                                                                    step.step === 'completed' ? "bg-green-500" :
                                                                                        "bg-blue-400"
                                                                            )} />
                                                                            <div className="flex-1 -mt-0.5">
                                                                                <div className="flex justify-between items-center mb-1.5">
                                                                                    <span className="text-sm font-black text-gray-800 dark:text-gray-200 capitalize tracking-tight">
                                                                                        {step.step.replace(/_/g, ' ')}
                                                                                    </span>
                                                                                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded uppercase font-bold">
                                                                                        +{format(new Date(step.ts), 'HH:mm:ss')}
                                                                                    </span>
                                                                                </div>
                                                                                {step.reason && (
                                                                                    <div className="text-xs text-red-600 bg-red-50/50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/20 font-medium">
                                                                                        <AlertCircle size={14} className="inline mr-2 mb-0.5" />
                                                                                        {step.reason}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <p className="text-xs text-gray-400 italic">No granular pipeline data available for this task.</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Request Metadata */}
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-6">
                                                                <div className="w-1.5 h-6 bg-purple-600 rounded-full" />
                                                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Task Metadata</h4>
                                                            </div>
                                                            <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 border border-gray-100 dark:border-zinc-800 shadow-inner">
                                                                <div className="space-y-4">
                                                                    <div>
                                                                        <span className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Original Prompt</span>
                                                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed italic border-l-4 border-gray-100 dark:border-zinc-800 pl-4 py-1">
                                                                            "{task.prompt}"
                                                                        </p>
                                                                    </div>

                                                                    {task.error_message && (
                                                                        <div className="pt-2">
                                                                            <span className="text-[10px] font-black text-red-400 uppercase mb-2 block tracking-widest">Stack Trace / Logs</span>
                                                                            <div className="bg-red-50/30 dark:bg-red-900/5 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
                                                                                <pre className="text-[11px] font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap leading-relaxed">
                                                                                    {task.error_message}
                                                                                </pre>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <div className="pt-4 flex items-center justify-between border-t border-gray-50 dark:border-zinc-800">
                                                                        <span className="text-[10px] font-black text-gray-400 uppercase">Internal Reference</span>
                                                                        <code className="text-[10px] font-mono select-all bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded text-gray-500">{task.id}</code>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-between px-2">
                <p className="text-xs text-gray-400 font-medium">System showing real-time updates for latest 50 requests.</p>
                <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse mr-2" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Feed Active</span>
                </div>
            </div>
        </div>
    );
}
