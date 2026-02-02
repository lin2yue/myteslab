'use client';

import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { Link } from '@/i18n/routing';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useAlert } from '@/components/alert/AlertProvider';

export default function AuthButton() {
    const t = useTranslations('Login');
    const alert = useAlert();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const [balance, setBalance] = useState<number | null>(null);

    useEffect(() => {
        const getUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);
                if (user) {
                    // Fetch Profile
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('avatar_url')
                        .eq('id', user.id)
                        .single();
                    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);

                    // Fetch Balance
                    const { data: credits } = await supabase
                        .from('user_credits')
                        .select('balance')
                        .eq('user_id', user.id)
                        .single();
                    if (credits) setBalance(credits.balance);

                    // Subscribe to balance changes
                    const channel = supabase
                        .channel(`balance_auth_button_${user.id}`)
                        .on('postgres_changes', {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'user_credits',
                            filter: `user_id=eq.${user.id}`
                        }, (payload) => {
                            setBalance(payload.new.balance);
                        })
                        .subscribe();

                    return () => {
                        supabase.removeChannel(channel);
                    };
                }
            } catch (e) {
                console.error('AuthButton: Get user error:', e);
            } finally {
                setIsLoading(false);
            }
        };
        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setUser(session?.user ?? null);
                if (!session?.user) {
                    setBalance(null);
                    setAvatarUrl(null);
                }
                setIsLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, [supabase]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setIsMenuOpen(false);
        const sign_out_msg = t('sign_out_success') || 'Successfully signed out';
        alert.success(sign_out_msg);
        router.refresh();
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    // Close menu when clicking outside (simple implementation)
    useEffect(() => {
        const closeMenu = () => setIsMenuOpen(false);
        if (isMenuOpen) {
            document.addEventListener('click', closeMenu);
        }
        return () => document.removeEventListener('click', closeMenu);
    }, [isMenuOpen]);

    const defaultAvatar = `https://ui-avatars.com/api/?name=${user?.email?.charAt(0) || 'U'}&background=random`;
    const tProfile = useTranslations('Profile');

    if (isLoading) return <div className="w-8 h-8" />; // Loading placeholder

    return user ? (
        <div className="relative flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* Balance Display */}
            {balance !== null && (
                <Link
                    href="/profile"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800/50 hover:bg-blue-100 transition-colors"
                >
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">{balance}</span>
                    <span className="text-[10px] font-bold text-blue-400 dark:text-blue-500 uppercase tracking-tight">{tProfile('credits')}</span>
                </Link>
            )}

            <button
                onClick={toggleMenu}
                className="flex items-center focus:outline-none group"
            >
                <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-gray-100 dark:border-zinc-800 group-hover:border-blue-400 transition-all shadow-sm">
                    <Image
                        src={avatarUrl || defaultAvatar}
                        alt="User Avatar"
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                    />
                </div>
            </button>

            {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl py-2 ring-1 ring-black/5 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('email_label')}</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {user.email}
                        </p>
                    </div>
                    <div className="py-1">
                        <Link
                            href="/profile"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            {tProfile('my_profile')}
                        </Link>
                        {/* Only show Admin Dashboard if needed - for now keeping it simple or check roles if available */}
                        <Link
                            href="/admin/tasks"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            {tProfile('admin_dashboard')}
                        </Link>
                    </div>
                    <div className="border-t border-gray-100 dark:border-zinc-800 mt-1 pt-1">
                        <button
                            onClick={handleSignOut}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            {tProfile('sign_out')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    ) : (
        <button
            onClick={() => {
                const currentUrl = window.location.pathname + window.location.search;
                localStorage.setItem('auth_redirect_next', currentUrl);
                window.location.href = `/login?next=${encodeURIComponent(currentUrl)}`;
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors"
        >
            {t('sign_in_or_sign_up')}
        </button>
    );
}
