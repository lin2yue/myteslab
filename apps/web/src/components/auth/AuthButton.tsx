'use client';

import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { Link } from '@/i18n/routing';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AuthButton() {
    const [user, setUser] = useState<User | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) {
                // Fetch profile for avatar
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('avatar_url')
                    .eq('id', user.id)
                    .single();
                if (profile?.avatar_url) {
                    setAvatarUrl(profile.avatar_url);
                }
            }
        };
        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setIsMenuOpen(false);
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

    return user ? (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={toggleMenu}
                className="flex items-center gap-2 focus:outline-none"
            >
                <div className="h-8 w-8 rounded-full overflow-hidden border border-gray-200">
                    <img
                        src={avatarUrl || defaultAvatar}
                        alt="User Avatar"
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
        <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors"
        >
            Sign In
        </Link>
    );
}
