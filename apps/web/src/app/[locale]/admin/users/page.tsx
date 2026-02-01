'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTranslations } from 'next-intl';
import {
    Users,
    Search,
    UserCircle,
    Mail,
    Calendar,
    Shield,
    Wallet,
    MoreHorizontal,
    ArrowUpDown,
    Check,
    X,
    Filter,
    Edit3
} from 'lucide-react';
import { useAlert } from '@/components/alert/AlertProvider';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface UserProfile {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    role: 'user' | 'admin' | 'super_admin';
    created_at: string;
    user_credits?: {
        balance: number;
    };
}

export default function AdminUsersPage() {
    const alert = useAlert();
    const supabase = createClient();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ role: string; balance: number }>({ role: 'user', balance: 0 });

    const fetchUsers = async () => {
        setLoading(true);
        // We fetch profiles and join with user_credits
        let query = supabase
            .from('profiles')
            .select(`
                *,
                user_credits (
                    balance
                )
            `)
            .order('created_at', { ascending: false });

        if (roleFilter !== 'all') {
            query = query.eq('role', roleFilter);
        }

        const { data, error } = await query;

        if (error) {
            alert.error(error.message);
        } else {
            setUsers(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, [roleFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Since we have all users (or limited by role), we can filter client-side for simple search
    };

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.display_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const startEditing = (user: UserProfile) => {
        setEditingUserId(user.id);
        setEditForm({
            role: user.role,
            balance: user.user_credits?.balance || 0
        });
    };

    const saveEdit = async (userId: string) => {
        // 1. Update Profile Role
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ role: editForm.role })
            .eq('id', userId);

        if (profileError) {
            alert.error(`Failed to update role: ${profileError.message}`);
            return;
        }

        // 2. Update Credits Balance
        const { error: creditError } = await supabase
            .from('user_credits')
            .update({ balance: editForm.balance })
            .eq('user_id', userId);

        if (creditError) {
            alert.error(`Failed to update balance: ${creditError.message}`);
        } else {
            alert.success('User updated successfully');
            fetchUsers();
        }
        setEditingUserId(null);
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'super_admin':
                return <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full border border-purple-200 uppercase tracking-tighter">Super Admin</span>;
            case 'admin':
                return <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200 uppercase tracking-tighter">Admin</span>;
            default:
                return <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-full border border-gray-200 uppercase tracking-tighter">User</span>;
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-600" />
                        User Management
                    </h1>
                    <p className="text-gray-500 mt-1">Manage platform users, roles, and credit balances.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search email or name..."
                            className="pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all w-full md:w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <select
                        className="px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="all">All Roles</option>
                        <option value="user">Users</option>
                        <option value="admin">Admins</option>
                        <option value="super_admin">Super Admins</option>
                    </select>
                </div>
            </div>

            {/* Stats Overview (Optional, but adds Premium feel) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Active Admins', value: users.filter(u => u.role !== 'user').length, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Total Platform Credits', value: users.reduce((acc, u) => acc + (u.user_credits?.balance || 0), 0), icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl", stat.bg)}>
                            <stat.icon className={cn("w-6 h-6", stat.color)} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                            <p className="text-2xl font-bold dark:text-white">{stat.value.toLocaleString()}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Table Area */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">User Details</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Role</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Balance</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Joined</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Fetching user data...</td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No users found matching your criteria.</td>
                                </tr>
                            ) : filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20 transition-colors group">
                                    {/* User Details */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-zinc-700">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <UserCircle className="w-6 h-6 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                    {user.display_name || 'No Name'}
                                                </span>
                                                <span className="text-xs text-gray-400 truncate flex items-center gap-1">
                                                    <Mail size={10} /> {user.email}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Role */}
                                    <td className="px-6 py-4 text-center">
                                        {editingUserId === user.id ? (
                                            <select
                                                className="text-xs p-1 rounded border border-gray-300 dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-blue-500"
                                                value={editForm.role}
                                                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                                            >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                                <option value="super_admin">SuperAdmin</option>
                                            </select>
                                        ) : (
                                            getRoleBadge(user.role)
                                        )}
                                    </td>

                                    {/* Balance */}
                                    <td className="px-6 py-4 text-center">
                                        {editingUserId === user.id ? (
                                            <input
                                                type="number"
                                                className="w-20 text-xs p-1 rounded border border-gray-300 dark:bg-zinc-800 outline-none focus:ring-1 focus:ring-blue-500 text-center"
                                                value={editForm.balance}
                                                onChange={(e) => setEditForm({ ...editForm, balance: parseInt(e.target.value) || 0 })}
                                            />
                                        ) : (
                                            <span className="text-sm font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                                {user.user_credits?.balance ?? 0}
                                            </span>
                                        )}
                                    </td>

                                    {/* Joined */}
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <span className="text-xs text-gray-500 flex items-center justify-center gap-1">
                                            <Calendar size={12} /> {format(new Date(user.created_at), 'yyyy-MM-dd')}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {editingUserId === user.id ? (
                                                <>
                                                    <button
                                                        onClick={() => saveEdit(user.id)}
                                                        className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
                                                        title="Save"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingUserId(null)}
                                                        className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors shadow-sm"
                                                        title="Cancel"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => startEditing(user)}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all"
                                                    title="Edit User"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Placeholder */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/30 flex justify-between items-center text-xs text-gray-400">
                    <span>Showing {filteredUsers.length} users</span>
                    <div className="flex gap-2">
                        <button disabled className="px-3 py-1 rounded border border-gray-200 dark:border-zinc-800 opacity-50">Prev</button>
                        <button disabled className="px-3 py-1 rounded border border-gray-200 dark:border-zinc-800 opacity-50">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
