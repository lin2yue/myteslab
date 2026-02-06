'use client';

import { useTranslations } from '@/lib/i18n';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function VerifyErrorPage() {
    const t = useTranslations('Auth');

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-3xl font-bold mb-4">{t('verify_error_title') || '链接无效或已过期'}</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
                {t('verify_error_desc') || '激活链接已失效（有效期24小时）或已被使用。请尝试重新登录并申请重发。'}
            </p>
            <div className="flex gap-4">
                <Link
                    href="/login"
                    className="btn-primary px-8 py-3"
                >
                    {t('back_to_login') || '返回登录'}
                </Link>
            </div>
        </div>
    );
}
