'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
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
    ExternalLink
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
    const supabase = createClient();
    const [tasks, setTasks] = useState<GenerationTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [refundingId, setRefundingId] = useState<string | null>(null);

    const fetchTasks = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('generation_tasks')
            .select(`
                *,
                profiles (
                    display_name,
                    email
                )
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            alert.error(error.message);
        } else {
            setTasks(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTasks();

        // Realtime subscription
        const channel = supabase
            .channel('admin-tasks-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'generation_tasks'
                },
                async (payload) => {
                    console.log('Realtime Event:', payload);

                    if (payload.eventType === 'INSERT') {
                        // New task: Fetch full details including profile
                        const { data: newTask, error } = await supabase
                            .from('generation_tasks')
                            .select(`
                                *,
                                profiles (
                                    display_name,
                                    email
                                )
                            `)
                            .eq('id', payload.new.id)
                            .single();

                        if (!error && newTask) {
                            setTasks((prev) => [newTask as GenerationTask, ...prev]);
                            // Optional: Alert or sound?
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        // Update existing task
                        setTasks((prev) =>
                            prev.map((task) =>
                                task.id === payload.new.id
                                    ? { ...task, ...payload.new }
                                    : task
                            )
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleRefund = async (taskId: string) => {
        if (!confirm(t('refund_confirm'))) return;

        setRefundingId(taskId);
        const { data, error } = await supabase.rpc('refund_task_credits', {
            p_task_id: taskId,
            p_reason: 'Manual admin refund'
        });

        if (error) {
            alert.error(error.message);
        } else if (data?.[0]?.success) {
            alert.success(t('refund_success'));
            fetchTasks();
        } else {
            alert.error(data?.[0]?.error_msg || t('refund_failed'));
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
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold">{t('tasks_title')}</h1>
                    <p className="text-gray-500 text-sm mt-1">{t('tasks_desc')}</p>
                </div>
                <button
                    onClick={fetchTasks}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                >
                    <RotateCcw className={cn("w-4 h-4", loading && "animate-spin")} />
                    {t('refresh')}
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">{t('user')}</th>
                            <th className="px-6 py-4">{t('prompt')}</th>
                            <th className="px-6 py-4">{t('amount')}</th>
                            <th className="px-6 py-4">{t('timestamp')}</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {loading && tasks.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">Loading tasks...</td>
                            </tr>
                        ) : tasks.map((task) => (
                            <React.Fragment key={task.id}>
                                <tr className={cn(
                                    "hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors group cursor-pointer",
                                    expandedTaskId === task.id && "bg-blue-50/20 dark:bg-blue-900/5"
                                )}>
                                    <td className="px-6 py-4" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                                        {getStatusBadge(task.status)}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                                        <div className="flex flex-col">
                                            <span className="text-gray-900 dark:text-white truncate max-w-[150px]">
                                                {task.profiles?.display_name || 'Unknown'}
                                            </span>
                                            <span className="text-xs text-gray-400 font-normal">{task.profiles?.email || task.user_id.substring(0, 8)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                                        {task.prompt}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono text-center" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                                        -{task.credits_spent}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                                        {format(new Date(task.created_at), 'MM-dd HH:mm:ss')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            {task.status === 'failed' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRefund(task.id); }}
                                                    disabled={refundingId === task.id}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                                                    title={t('refund_btn')}
                                                >
                                                    <RotateCcw className={cn("w-4 h-4", refundingId === task.id && "animate-spin")} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-all"
                                            >
                                                {expandedTaskId === task.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>

                                {/* Expanded Steps Detail */}
                                {expandedTaskId === task.id && (
                                    <tr className="bg-gray-50/50 dark:bg-zinc-900/50">
                                        <td colSpan={6} className="px-10 py-6 border-l-4 border-blue-500">
                                            <div className="grid grid-cols-2 gap-8">
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{t('steps_title')}</h4>
                                                    <div className="space-y-4">
                                                        {Array.isArray(task.steps) && task.steps.length > 0 ? (
                                                            task.steps.map((step, idx) => (
                                                                <div key={idx} className="flex gap-4 items-start relative pb-4">
                                                                    {idx < task.steps.length - 1 && <div className="absolute left-[7px] top-4 bottom-0 w-[2px] bg-gray-200 dark:bg-zinc-800" />}
                                                                    <div className={cn(
                                                                        "w-4 h-4 rounded-full mt-1 shrink-0 border-2",
                                                                        step.step === 'refunded' ? "bg-blue-500 border-blue-200" :
                                                                            step.step === 'completed' ? "bg-green-500 border-green-200" :
                                                                                "bg-gray-300 border-white"
                                                                    )} />
                                                                    <div className="flex-1">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <span className="text-sm font-bold capitalize">{step.step.replace(/_/g, ' ')}</span>
                                                                            <span className="text-[10px] font-mono text-gray-400">{format(new Date(step.ts), 'HH:mm:ss.SSS')}</span>
                                                                        </div>
                                                                        {step.reason && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/10 p-2 rounded mt-1 border border-red-100 dark:border-red-900/30">{step.reason}</p>}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs text-gray-400 italic">No detailed steps recorded.</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{t('context_title')}</h4>
                                                    <div className="space-y-4 text-xs font-mono">
                                                        <div className="bg-gray-100 dark:bg-zinc-800 p-3 rounded-lg overflow-auto max-h-[300px]">
                                                            <p className="text-blue-600 dark:text-blue-400 mb-2">// Prompt</p>
                                                            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 mb-4">{task.prompt}</p>

                                                            {task.error_message && (
                                                                <>
                                                                    <p className="text-red-500 mb-2">// Error Trace</p>
                                                                    <p className="text-red-600 dark:text-red-400">{task.error_message}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between items-center text-gray-400 px-2 font-sans">
                                                            <span>Task ID: <span className="select-all">{task.id}</span></span>
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

            {tasks.length === 50 && (
                <div className="text-center p-4">
                    <p className="text-sm text-gray-400">Showing last 50 tasks. More filtering options coming soon.</p>
                </div>
            )}
        </div>
    );
}
