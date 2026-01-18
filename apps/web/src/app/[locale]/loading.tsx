import { useTranslations } from 'next-intl'

export default function Loading() {
    const t = useTranslations('Index')

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
            <div className="text-center">
                {/* Tesla-style loading animation */}
                <div className="relative w-14 h-14 mx-auto mb-6">
                    {/* Outer ring */}
                    <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                    {/* Spinning arc */}
                    <div className="absolute inset-0 border-4 border-transparent border-t-gray-400 rounded-full animate-spin"></div>
                    {/* Inner pulse */}
                    <div className="absolute inset-2 bg-gray-300/10 rounded-full animate-pulse"></div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {t('loading')}
                </h3>
                <div className="flex items-center justify-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
            </div>
        </div>
    )
}
