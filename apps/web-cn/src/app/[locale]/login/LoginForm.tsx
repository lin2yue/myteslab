'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { login, signup, resendVerificationAction } from './actions';
import { trackLogin, trackSignUp } from '@/lib/analytics';
import { Loader2, Mail, Lock, Phone, ShieldCheck, QrCode, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAlert } from '@/components/alert/AlertProvider';

type AuthMode = 'LOGIN' | 'SIGNUP';
type AuthTab = 'EMAIL' | 'PHONE';

export default function LoginForm() {
    const t = useTranslations('Login');
    const alert = useAlert();
    const locale = useLocale();
    const searchParams = useSearchParams();

    const [authTab, setAuthTab] = useState<AuthTab>('EMAIL');
    const [mode, setMode] = useState<AuthMode>('LOGIN');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [smsTimer, setSmsTimer] = useState(0);
    const [isSmsSending, setIsSmsSending] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(searchParams.get('error'));
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (smsTimer <= 0) return;
        const timer = setInterval(() => {
            setSmsTimer((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [smsTimer]);

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
                    setMode('LOGIN'); // 切换回登录模式让用户知道接下来要做什么
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

    const handleSendSms = async () => {
        if (!phone || smsTimer > 0) return;
        setIsSmsSending(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/phone/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                setError(data?.error || '发送失败');
                return;
            }
            setSmsTimer(60);
            alert.success(t('sms_sent') || '验证码已发送');
        } catch (e) {
            console.error(e);
            setError(t('error_default'));
        } finally {
            setIsSmsSending(false);
        }
    };

    const handlePhoneLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!phone || !code) return;

        startTransition(async () => {
            const res = await fetch('/api/auth/phone/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, code }),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) {
                setError(data?.error || t('error_default'));
                return;
            }
            alert.success(t('login_success') || 'Login successful!');
            trackLogin('phone');
            const next = getNext();
            if (typeof window !== 'undefined') {
                localStorage.removeItem('auth_redirect_next');
                window.location.href = next;
            }
        });
    };

    const handleWechatLogin = () => {
        const next = getNext();
        if (typeof window !== 'undefined') {
            window.location.href = `/api/auth/wechat/login?next=${encodeURIComponent(next)}`;
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
                {mode === 'LOGIN' ? (t('welcome_back') || 'Welcome Back') : (t('create_account') || 'Create Account')}
            </h2>

            <div className="grid grid-cols-2 gap-2 mb-6">
                <button
                    type="button"
                    onClick={() => setAuthTab('EMAIL')}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border ${authTab === 'EMAIL'
                        ? 'bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-gray-900 dark:text-white'
                        : 'bg-white/60 dark:bg-zinc-900/60 border-black/5 dark:border-white/10 text-gray-500'
                        }`}
                >
                    {t('tab_email') || '邮箱'}
                </button>
                <button
                    type="button"
                    onClick={() => setAuthTab('PHONE')}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border ${authTab === 'PHONE'
                        ? 'bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 text-gray-900 dark:text-white'
                        : 'bg-white/60 dark:bg-zinc-900/60 border-black/5 dark:border-white/10 text-gray-500'
                        }`}
                >
                    {t('tab_phone') || '手机号'}
                </button>
            </div>

            {renderError()}
            {renderSuccess()}

            {authTab === 'EMAIL' ? (
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
            ) : (
                <form onSubmit={handlePhoneLogin} className="space-y-4">
                    <div className="relative group">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-gray-900 dark:group-focus-within:text-white transition-colors" />
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder={t('phone_placeholder') || '请输入手机号'}
                            required
                            className="input-field pl-10"
                        />
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div className="relative group">
                            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-gray-900 dark:group-focus-within:text-white transition-colors" />
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder={t('sms_placeholder') || '请输入验证码'}
                                required
                                className="input-field pl-10"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSendSms}
                            disabled={isSmsSending || smsTimer > 0 || !phone}
                            className="px-4 rounded-xl text-sm font-semibold border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                            {smsTimer > 0 ? `${smsTimer}s` : (isSmsSending ? '发送中' : (t('send_sms') || '获取验证码'))}
                        </button>
                    </div>

                    <button
                        disabled={isPending || !phone || !code}
                        className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (t('phone_login') || '验证码登录')}
                    </button>
                </form>
            )}

            <div className="relative my-6">
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
                type="button"
                onClick={handleWechatLogin}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-black/10 dark:border-white/10 rounded-xl bg-white/90 dark:bg-zinc-900/70 text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shadow-[0_8px_18px_rgba(0,0,0,0.08)]"
            >
                <QrCode className="w-5 h-5" />
                {t('wechat_login') || '微信扫码登录'}
            </button>

            <div className="mt-8 text-center">
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
            </div>
        </div>
    );
}
