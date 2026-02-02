import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default function CheckoutSuccessPage() {
    const t = useTranslations('Checkout');

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="flex justify-center mb-6">
                    <div className="p-3 rounded-full bg-green-100 text-green-600">
                        <CheckCircle2 className="w-16 h-16" />
                    </div>
                </div>

                <h1 className="text-3xl font-black text-gray-900 mb-4">
                    {t('success_title')}
                </h1>

                <p className="text-gray-600 mb-8 leading-relaxed">
                    {t('success_desc')}
                </p>

                <div className="space-y-4">
                    <Link
                        href="/ai-generator"
                        className="block w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200"
                    >
                        {t('back_to_generator')}
                    </Link>

                    <Link
                        href="/profile"
                        className="block w-full py-4 bg-white border-2 border-gray-100 hover:border-gray-200 text-gray-600 rounded-xl font-bold transition-all"
                    >
                        {t('view_balance')}
                    </Link>
                </div>

                <p className="mt-8 text-sm text-gray-400">
                    Any questions? Contact us at support@myteslab.com
                </p>
            </div>
        </div>
    );
}
