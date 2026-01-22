'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState, useTransition, useEffect, useRef } from 'react';
import { login, signup, checkUserExists, resetPassword, resendVerification } from './actions';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, Mail, Lock, CheckCircle2, Loader2, ChevronRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type ViewState = 'EMAIL' | 'LOGIN' | 'SIGNUP' | 'VERIFY' | 'FORGOT' | 'RESET_SENT';

export default function LoginForm() {
    const t = useTranslations('Login');
    const locale = useLocale();
    const searchParams = useSearchParams();

    // States
    const [view, setView] = useState<ViewState>('EMAIL');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(searchParams.get('error'));
    const [isPending, startTransition] = useTransition();
    const [resendTimer, setResendTimer] = useState(0);

    const emailInputRef = useRef<HTMLInputElement>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    // Initial check for params
    useEffect(() => {
        const success = searchParams.get('success');
        if (success === 'check_email') {
            setView('VERIFY');
            setResendTimer(60);
        }
    }, [searchParams]);

    // Countdown timer for resend
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (resendTimer > 0) {
            timer = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [resendTimer]);

    const handleGoogleLogin = async () => {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/api/auth/callback?next=/${locale}`,
            },
        });
        if (error) setError(error.message);
    };

    const onContinue = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!email) return;

        startTransition(async () => {
            const result = await checkUserExists(email);
            if (result.exists) {
                if (result.confirmed) {
                    setView('LOGIN');
                } else {
                    setView('VERIFY');
                    setResendTimer(60);
                }
            } else {
                setView('SIGNUP');
            }
        });
    };

    const onLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        startTransition(async () => {
            const result = await login(formData);
            if (result && !result.success) {
                setError(result.error || t('error_invalid_credentials'));
            }
        });
    };

    const onSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        startTransition(async () => {
            const result = await signup(formData);
            if (result.success) {
                setView('VERIFY');
                setResendTimer(60);
            } else {
                setError(result.error || t('error_default'));
            }
        });
    };

    const onForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const result = await resetPassword(email);
            if (result.success) {
                setView('RESET_SENT');
            } else {
                setError(result.error || t('error_default'));
            }
        });
    };

    const handleResend = async () => {
        if (resendTimer > 0) return;
        startTransition(async () => {
            const result = await resendVerification(email);
            if (result.success) {
                setResendTimer(60);
            } else {
                setError(result.error || t('error_default'));
            }
        });
    };

    const goBack = () => {
        setError(null);
        if (view === 'LOGIN' || view === 'SIGNUP' || view === 'FORGOT') setView('EMAIL');
        if (view === 'VERIFY') setView('SIGNUP');
        if (view === 'RESET_SENT') setView('FORGOT');
    };

    // Render helpers
    const renderHeader = (title: string, showBack = false) => (
        <div className="relative mb-8 pt-2">
            {showBack && (
                <button
                    onClick={goBack}
                    className="absolute left-0 top-0 p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                    aria-label={t('back')}
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
            )}
            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mt-4">
                {title}
            </h2>
        </div>
    );

    const renderError = () => error && (
        <div className="flex items-center gap-2 p-3 mb-6 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/50 rounded-lg animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error === 'Invalid login credentials' ? t('error_invalid_credentials') : error}</p>
        </div>
    );

    return (
        <div className="w-full max-w-md p-8 bg-white dark:bg-zinc-800/50 shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-zinc-700/50 rounded-3xl backdrop-blur-sm transition-all duration-500">
            {/* EMAIL VIEW */}
            {view === 'EMAIL' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">
                        {t('title')}
                    </h2>
                    <p className="text-gray-500 text-center mb-8 text-sm">
                        {t('or')} {searchParams.get('next') ? 'continue to your destination' : 'explore the studio'}
                    </p>

                    <form onSubmit={onContinue} className="space-y-4">
                        <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                ref={emailInputRef}
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t('email_placeholder')}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                        </div>
                        <button
                            disabled={isPending || !email}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : t('continue')}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-100 dark:border-zinc-700" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="px-2 bg-white dark:bg-zinc-800 text-gray-400">
                                {t('or')}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Google
                    </button>
                </div>
            )}

            {/* LOGIN VIEW */}
            {view === 'LOGIN' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    {renderHeader(t('welcome_back'), true)}
                    {renderError()}
                    <form onSubmit={onLogin} className="space-y-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-xl flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                                {email[0].toUpperCase()}
                            </div>
                            <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{email}</span>
                        </div>

                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                ref={passwordInputRef}
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('password_placeholder')}
                                required
                                autoFocus
                                className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setView('FORGOT')}
                                className="text-xs text-blue-500 hover:underline font-medium"
                            >
                                {t('forgot_password')}
                            </button>
                        </div>

                        <button
                            disabled={isPending || password.length < 6}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                        >
                            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : t('sign_in')}
                        </button>
                    </form>
                </div>
            )}

            {/* SIGNUP VIEW */}
            {view === 'SIGNUP' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    {renderHeader(t('create_account'), true)}
                    {renderError()}
                    <form onSubmit={onSignup} className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="email"
                                value={email}
                                readOnly
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-500 outline-none"
                            />
                        </div>

                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('password_placeholder')}
                                required
                                autoFocus
                                className="w-full pl-10 pr-12 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        <button
                            disabled={isPending || password.length < 6}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                        >
                            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : t('sign_up')}
                        </button>
                    </form>
                </div>
            )}

            {/* VERIFY VIEW */}
            {view === 'VERIFY' && (
                <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 className="w-10 h-10 text-green-500 animate-in zoom-in-0 duration-700 delay-300 fill-mode-both" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                        {t('check_email_title')}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-[280px] leading-relaxed">
                        {t('check_email_desc', { email })}
                    </p>

                    <div className="space-y-4 w-full">
                        <button
                            onClick={handleResend}
                            disabled={isPending || resendTimer > 0}
                            className="w-full py-3 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-zinc-950 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            {isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            ) : resendTimer > 0 ? (
                                t('resend_after', { count: resendTimer })
                            ) : (
                                t('resend_email')
                            )}
                        </button>
                        <button
                            onClick={goBack}
                            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {t('back')}
                        </button>
                    </div>
                </div>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {view === 'FORGOT' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                    {renderHeader(t('reset_password_title'), true)}
                    <p className="text-gray-500 text-center mb-6 text-sm">
                        {t('reset_password_desc')}
                    </p>
                    {renderError()}
                    <form onSubmit={onForgotPassword} className="space-y-4">
                        <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t('email_placeholder')}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl outline-none"
                            />
                        </div>
                        <button
                            disabled={isPending || !email}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                        >
                            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : t('send_reset_link')}
                        </button>
                    </form>
                </div>
            )}

            {/* RESET SENT VIEW */}
            {view === 'RESET_SENT' && (
                <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-6">
                        <Mail className="w-10 h-10 text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                        {t('reset_link_sent')}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-[280px]">
                        {t('reset_link_sent_desc')}
                    </p>
                    <button
                        onClick={() => setView('LOGIN')}
                        className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl hover:opacity-90 transition-all"
                    >
                        {t('back')}
                    </button>
                </div>
            )}
        </div>
    );
}
