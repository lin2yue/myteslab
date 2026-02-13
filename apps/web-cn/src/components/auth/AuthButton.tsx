'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useAlert } from '@/components/alert/AlertProvider';
import PricingModal from '@/components/pricing/PricingModal';
import { Zap } from 'lucide-react';
import { useCredits } from '@/components/credits/CreditsProvider';

type SessionUser = {
    id: string;
    email: string | null;
    phone: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
};

export default function AuthButton() {
    const t = useTranslations('Login');
    const alert = useAlert();
    const [user, setUser] = useState<SessionUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const router = useRouter();

    const { balance, loading: creditsLoading, setBalance } = useCredits();
    const [isPricingOpen, setIsPricingOpen] = useState(false);

    useEffect(() => {
        const getUser = async () => {
            try {
                const res = await fetch('/api/auth/me', { cache: 'no-store' });
                const data = await res.json();
                setUser(data?.user || null);
                setAvatarUrl(data?.user?.avatar_url || null);
            } catch (e) {
                console.error('AuthButton: Get user error:', e);
            } finally {
                setIsLoading(false);
            }
        };
        getUser();
    }, []);

    const handleSignOut = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        if (typeof window !== 'undefined') {
            localStorage.removeItem('wrap_gallery_last_model');
        }
        setUser(null);
        setAvatarUrl(null);
        setBalance(null);
        setIsMenuOpen(false);
        alert.success(t('logout_success') || '已退出登录');
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

    const nameSeed = user?.display_name || user?.email || user?.phone || 'U';
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameSeed?.toString().charAt(0) || 'U')}&background=random`;
    const tProfile = useTranslations('Profile');

    const containerClass = "min-w-[64px] sm:min-w-[90px] md:min-w-[170px] h-10 flex items-center justify-start flex-shrink-0";

    if (isLoading || creditsLoading) {
        return (
            <div className={containerClass}>
                <div className="h-9 w-12 sm:w-16 md:w-28 rounded-full bg-gray-200 dark:bg-zinc-800 animate-pulse" />
            </div>
        );
    }

    return (
        <div className={containerClass}>
            {user ? (
                <div className="relative flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {/* Balance Display */}
                    {balance !== null && (
                        <button
                            onClick={() => setIsPricingOpen(true)}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/5 dark:bg-white/10 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-900/10 dark:hover:bg-white/15 transition-all hover:scale-105 active:scale-95"
                        >
                            <Zap className="w-3.5 h-3.5 text-zinc-800 dark:text-white" />
                            <span className="text-sm font-semibold text-zinc-900 dark:text-white">{balance}</span>
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-tight">{tProfile('credits')}</span>
                        </button>
                    )}

                    <button
                        onClick={toggleMenu}
                        className="flex items-center focus:outline-none group"
                    >
                        <div className="h-9 w-9 rounded-full overflow-hidden border border-black/10 dark:border-white/10 group-hover:border-black/30 dark:group-hover:border-white/30 transition-all shadow-[0_1px_0_rgba(0,0,0,0.06)]">
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
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white/98 dark:bg-zinc-900/98 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.18)] p-1.5 ring-1 ring-black/5 dark:ring-white/10 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur no-scrollbar">
                            <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t('email_label')}</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                    {user.display_name || user.email || user.phone || '用户'}
                                </p>
                            </div>
                            <div className="py-1">
                                <Link
                                    href="/profile"
                                    className="flex items-center gap-3 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    {tProfile('my_profile')}
                                </Link>
                                {/* Only show Admin Dashboard if needed - for now keeping it simple or check roles if available */}
                                {(user.role === 'admin' || user.role === 'super_admin') && (
                                    <Link
                                        href="/admin/tasks"
                                        className="flex items-center gap-3 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        {tProfile('admin_dashboard')}
                                    </Link>
                                )}
                            </div>
                            <div className="border-t border-gray-100 dark:border-zinc-800 mt-1 pt-1">
                                <button
                                    onClick={handleSignOut}
                                    className="flex w-full items-center gap-3 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-lg"
                                >
                                    {tProfile('sign_out')}
                                </button>
                            </div>
                        </div>
                    )}

                    <PricingModal
                        isOpen={isPricingOpen}
                        onClose={() => setIsPricingOpen(false)}
                    />
                </div>
            ) : (
                <button
                    onClick={() => {
                        const currentUrl = window.location.pathname + window.location.search;
                        localStorage.setItem('auth_redirect_next', currentUrl);
                        window.location.href = `/login?next=${encodeURIComponent(currentUrl)}`;
                    }}
                    className="h-10 px-4 text-sm font-semibold text-white bg-black rounded-xl hover:bg-zinc-800 transition-colors shadow-[0_8px_18px_rgba(0,0,0,0.18)] hover:shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                >
                    {t('sign_in_or_sign_up')}
                </button>
            )}
        </div>
    );
}
