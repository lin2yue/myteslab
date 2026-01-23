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

    useEffect(() => {
        const getUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                console.log('AuthButton: Initial user check:', user?.id);
                setUser(user);
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('avatar_url')
                        .eq('id', user.id)
                        .single();
                    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
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
                console.log('AuthButton: Auth state changed:', event, session?.user?.id);
                setUser(session?.user ?? null);
                setIsLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, [supabase]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setIsMenuOpen(false);
        alert.success(t('sign_out_success') || 'Successfully signed out');
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

    if (isLoading) return <div className="w-8 h-8" />; // Loading placeholder

    return user ? (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={toggleMenu}
                className="flex items-center gap-2 focus:outline-none"
            >
                <div className="h-8 w-8 rounded-full overflow-hidden border border-gray-200">
                    <Image
                        src={avatarUrl || defaultAvatar}
                        alt="User Avatar"
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                    />
                </div>
            </button>

            {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-50">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user.email}
                        </p>
                    </div>
                    <Link
                        href="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        My Profile
                    </Link>
                    <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    >
                        Sign Out
                    </button>
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
