'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { login, signup, resendVerificationAction } from './actions';
import { trackLogin, trackSignUp } from '@/lib/analytics';
import { Loader2, Mail, Lock, AlertCircle, Eye, EyeOff, QrCode } from 'lucide-react';
import { useAlert } from '@/components/alert/AlertProvider';
import WechatScan from '@/components/auth/WechatScan';
import { ShieldCheck } from 'lucide-react';

type AuthMode = 'LOGIN' | 'SIGNUP';

export default function LoginForm() {
    const t = useTranslations('Login');
    const alert = useAlert();
    const locale = useLocale();
    const searchParams = useSearchParams();

    // UI State
    const [useEmail, setUseEmail] = useState(false); // Default to FALSE (WeChat mode)
    const [mode, setMode] = useState<AuthMode>('LOGIN'); // Only for Email mode

    // Email Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isResending, setIsResending] = useState(false);

    // Global State
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(searchParams.get('error'));
    const [isPending, startTransition] = useTransition();

    const getNext = () => {
        let next = searchParams.get('next');
        if (!next && typeof window !== 'undefined') {
            next = localStorage.getItem('auth_redirect_next');
        }
        return next || `/${locale}`;
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!email || !password) return;

        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);

        startTransition(async () => {
            if (mode === 'LOGIN') {
                const result = await login(formData);
                if (!result?.success) {
                    if (result?.needsVerification) {
                        setError(`请先在邮箱 ${result.email} 中点击激活链接。没有收到？`);
                        setSuccessMessage(null);
                        return;
                    }
                    setError(result?.error || t('error_invalid_credentials'));
                    return;
                }
                alert.success(t('login_success') || 'Login successful!');
                trackLogin('email');
            } else {
                const result = await signup(formData);
                if (!result?.success) {
                    setError(result?.error || t('error_default'));
                    return;
                }

                if (result.requiresVerification) {
                    setSuccessMessage(result.message || '注册成功！请检查您的邮箱进行激活。');
                    setError(null);
                    setMode('LOGIN'); // Switch back to login for UX
                    return;
                }

                alert.success(t('signup_success') || 'Sign up successful!');
                trackSignUp('email');
            }

            const next = getNext();
            if (typeof window !== 'undefined') {
                localStorage.removeItem('auth_redirect_next');
                window.location.href = next;
            }
        });
    };

    const handleResend = async () => {
        if (!email || isResending) return;
        setIsResending(true);
        try {
            const result = await resendVerificationAction(email);
            if (result.success) {
                alert.success(result.message || '验证邮件已重发');
            } else {
                setError(result.error || '重发失败');
            }
        } catch (e) {
            setError('网络错误');
        } finally {
            setIsResending(false);
        }
    };

    const handleWechatSuccess = () => {
        const next = getNext();
        if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_redirect_next');
            window.location.href = next;
        }
    };

    const renderError = () => error && (
        <div className="flex flex-col gap-2 p-3 mb-6 text-sm text-red-600 bg-red-50/80 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/50 rounded-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
            </div>
            {error.includes('激活') && (
                <button
                    onClick={handleResend}
                    disabled={isResending}
                    className="text-left text-xs font-bold underline hover:text-red-700 disabled:opacity-50"
                >
                    {isResending ? '正在重发...' : '点击这里重发激活邮件'}
                </button>
            )}
        </div>
    );

    const renderSuccess = () => successMessage && (
        <div className="flex items-center gap-2 p-3 mb-6 text-sm text-green-600 bg-green-50/80 dark:bg-green-900/20 dark:text-green-400 border border-green-100 dark:border-green-900/50 rounded-lg animate-in fade-in slide-in-from-top-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <p>{successMessage}</p>
        </div>
    );

    return (
        <div className="w-full max-w-md p-8 panel transition-all duration-500">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">
                {useEmail
                    ? (mode === 'LOGIN' ? (t('welcome_back') || 'Welcome Back') : (t('create_account') || 'Create Account'))
                    : (t('wechat_login_title') || '微信安全登录')
                }
            </h2>

            {renderError()}
            {renderSuccess()}

            {!useEmail ? (
                // --- WECHAT SCAN SECTION (DEFAULT) ---
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <WechatScan onSuccess={handleWechatSuccess} />

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-black/5 dark:border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="px-2 bg-white/70 dark:bg-zinc-900/70 text-gray-400 backdrop-blur">
                                {t('or')}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => setUseEmail(true)}
                        className="w-full py-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                        <Mail className="w-4 h-4" />
                        {t('login_with_email') || '其他方式：邮箱账号登录'}
                    </button>
                </div>
            ) : (
                // --- EMAIL FORM SECTION (SECONDARY) ---
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-gray-900 dark:group-focus-within:text-white transition-colors" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={t('email_placeholder')}
                                required
                                className="input-field pl-10"
                            />
                        </div>

                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-gray-900 dark:group-focus-within:text-white transition-colors" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('password_placeholder')}
                                required
                                className="input-field pl-10 pr-12"
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
                            disabled={isPending || !email || password.length < 6}
                            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'LOGIN' ? (t('continue') || '登录') : (t('create_account_btn') || '注册'))}
                        </button>
                    </form>

                    <div className="mt-4 text-center space-y-3">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            {mode === 'LOGIN' ? (
                                <>
                                    {t('no_account') || '还没有账号？'}
                                    <button
                                        onClick={() => { setMode('SIGNUP'); setError(null); }}
                                        className="text-gray-900 dark:text-white font-semibold hover:underline ml-1"
                                    >
                                        {t('sign_up_link') || '立即注册'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {t('has_account') || '已有账号？'}
                                    <button
                                        onClick={() => { setMode('LOGIN'); setError(null); }}
                                        className="text-gray-900 dark:text-white font-semibold hover:underline ml-1"
                                    >
                                        {t('login_link') || '直接登录'}
                                    </button>
                                </>
                            )}
                        </p>

                        <div className="border-t border-black/5 dark:border-white/10 my-3" />

                        <button
                            onClick={() => setUseEmail(false)}
                            className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center justify-center gap-2 w-full py-2"
                        >
                            <QrCode className="w-4 h-4" />
                            {t('back') || '返回微信扫码'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
