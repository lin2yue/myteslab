'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export default function VerifySuccessPage() {
    const t = useTranslations('Auth');

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                <ShieldCheck className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-4">{t('verify_success_title') || '账户激活成功'}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
                {t('verify_success_desc') || '您的邮箱已验证完成。现在您可以登录特玩并开始您的创作之旅了。'}
            </p>
            <Link
                href="/login"
                className="btn-primary px-8 py-3"
            >
                {t('go_to_login') || '前往登录'}
            </Link>
        </div>
    );
}
