'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTranslations } from 'next-intl';
import {
    Search,
    Filter,
    Eye,
    EyeOff,
    Trash2,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Image as ImageIcon,
    User,
    Car
} from 'lucide-react';
import { useAlert } from '@/components/alert/AlertProvider';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { revalidateWraps } from '@/app/actions/revalidate';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface WrapRecord {
    id: string;
    name: string;
    model_slug: string;
    category: string;
    preview_url: string;
    is_active: boolean;
    is_public: boolean;
    created_at: string;
    profiles: {
        display_name: string;
        email: string;
    } | null;
}

export default function AdminWrapsPage() {
    const t = useTranslations('Admin');
    const alert = useAlert();
    const supabase = createClient();

    const [wraps, setWraps] = useState<WrapRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('all');
    const [page, setPage] = useState(1);
    const pageSize = 12;

    const fetchWraps = async () => {
        setLoading(true);
        let query = supabase
            .from('wraps')
            .select(`
                *,
                profiles (
                    display_name,
                    email
                )
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        if (categoryFilter !== 'all') {
            query = query.eq('category', categoryFilter);
        }

        if (statusFilter === 'active') {
            query = query.eq('is_active', true);
        } else if (statusFilter === 'hidden') {
            query = query.eq('is_active', false);
        }

        const { data, error, count } = await query
            .range((page - 1) * pageSize, page * pageSize - 1);

        if (error) {
            alert.error(error.message);
        } else {
            setWraps(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchWraps();
    }, [page, categoryFilter, statusFilter]);

    const toggleStatus = async (wrapId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('wraps')
            .update({ is_active: !currentStatus })
            .eq('id', wrapId);

        if (error) {
            alert.error(t('update_failed'));
        } else {
            await revalidateWraps();
            alert.success(t('update_success'));
            setWraps(wraps.map(w => w.id === wrapId ? { ...w, is_active: !currentStatus } : w));
        }
    };

    const filteredWraps = wraps.filter(wrap =>
        wrap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (wrap.profiles?.display_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (wrap.model_slug?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        Content Moderation
                    </h1>
                    <p className="text-sm text-gray-500 font-medium max-w-lg">
                        Manage all published works. Use the accessibility toggle to hide reported or inappropriate content from the public gallery.
                    </p>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by name, author or model..."
                        className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex gap-2">
                    <select
                        className="px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[140px]"
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                    >
                        <option value="all">All Categories</option>
                        <option value="official">Official</option>
                        <option value="ai_generated">AI Generated</option>
                        <option value="diy">DIY</option>
                    </select>

                    <select
                        className="px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[140px]"
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active Only</option>
                        <option value="hidden">Hidden Only</option>
                    </select>
                </div>
            </div>

            {/* Content Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="aspect-[4/3] rounded-2xl bg-gray-100 dark:bg-zinc-800 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredWraps.map((wrap) => (
                        <div
                            key={wrap.id}
                            className={cn(
                                "group relative bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
                                wrap.is_active ? "border-gray-100 dark:border-zinc-800" : "border-red-100 bg-red-50/10 grayscale-[0.5]"
                            )}
                        >
                            {/* Card Image */}
                            <div className="aspect-[4/3] relative overflow-hidden bg-gray-50 dark:bg-zinc-800">
                                <img
                                    src={wrap.preview_url}
                                    alt={wrap.name}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                {/* Status Badge Overlay */}
                                {!wrap.is_active && (
                                    <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                                        <EyeOff size={12} />
                                        Hidden
                                    </div>
                                )}
                            </div>

                            {/* Card Body */}
                            <div className="p-5 space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate mb-1">
                                        {wrap.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                                        <Car size={14} className="opacity-60" />
                                        <span className="capitalize">{wrap.model_slug?.replace(/-/g, ' ')}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-gray-50 dark:border-zinc-800/50">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                                        {wrap.profiles?.display_name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate leading-none mb-1">
                                            {wrap.profiles?.display_name || 'Anonymous'}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-medium leading-none">
                                            {format(new Date(wrap.created_at), 'MMM dd, yyyy')}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={() => toggleStatus(wrap.id, wrap.is_active)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                                            wrap.is_active
                                                ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600"
                                                : "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/20"
                                        )}
                                    >
                                        {wrap.is_active ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Publish</>}
                                    </button>
                                    <a
                                        href={`/zh/wraps/${wrap.id}`}
                                        target="_blank"
                                        className="p-2 bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:text-blue-600 rounded-xl transition-colors"
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredWraps.length === 0 && (
                <div className="bg-white dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-800 rounded-[2.5rem] py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                        <ImageIcon className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No works found</h3>
                    <p className="text-sm text-gray-400 max-w-xs">
                        Adjust your filters or search terms to find what you're looking for.
                    </p>
                </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between pt-8 border-t border-gray-100 dark:border-zinc-800">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                    Page {page}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-all shadow-sm"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={wraps.length < pageSize}
                        className="p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30 transition-all shadow-sm"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
