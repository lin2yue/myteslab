import Image from 'next/image'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import type { Wrap } from '@/lib/types'
import { getOptimizedImageUrl } from '@/lib/images'
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage'

interface WrapCardProps {
    wrap: Wrap
}

export function WrapCard({ wrap }: WrapCardProps) {
    const locale = useLocale()
    const name = locale === 'en' ? wrap.name_en || wrap.name : wrap.name

    // 车型展示名称映射 (专业版)
    const modelNameMap: Record<string, any> = {
        'en': {
            'cybertruck': 'Cybertruck',
            'model-3': 'Model 3 (Legacy)',
            'model-3-2024-plus': 'Model 3 (2024+)',
            'model-y-pre-2025': 'Model Y (Legacy)',
            'model-y-2025-plus': 'Model Y (New)',
        },
        'zh': {
            'cybertruck': 'Cybertruck',
            'model-3': 'Model 3 (经典款)',
            'model-3-2024-plus': 'Model 3 (焕新版)',
            'model-y-pre-2025': 'Model Y (经典款)',
            'model-y-2025-plus': 'Model Y (2025+)',
        }
    }

    const currentMap = modelNameMap[locale] || modelNameMap['en']
    const modelDisplay = wrap.model_slug ? (currentMap[wrap.model_slug] || wrap.model_slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')) : (wrap.category === 'official' ? 'Official' : 'Custom')

    return (
        <Link href={`/wraps/${wrap.slug}`}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group border border-gray-100 dark:border-zinc-800 flex flex-col h-full">
                {/* 预览图容器 */}
                <div className="aspect-[4/3] relative bg-gray-50 overflow-hidden">
                    {wrap.preview_image_url ? (
                        <ResponsiveOSSImage
                            src={wrap.preview_image_url}
                            alt={name}
                            fill
                            className="object-cover scale-[1.01] group-hover:scale-110 transition-transform duration-500 ease-out"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}

                    {/* 车型角标 */}
                    <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full uppercase tracking-wider border border-white/20">
                            {modelDisplay}
                        </span>
                    </div>

                    {/* 悬浮遮罩 - 增强质感 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* 内容区域 */}
                <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors line-clamp-1 text-base mb-3">
                        {name}
                    </h3>

                    <div className="mt-auto flex items-center justify-between gap-3">
                        {/* 作者信息 */}
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex-shrink-0 relative overflow-hidden ring-1 ring-gray-100">
                                {wrap.author_avatar_url ? (
                                    <Image
                                        src={wrap.author_avatar_url}
                                        alt={wrap.author_name || 'User'}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                                        <span className="text-[10px] text-gray-500 font-bold">
                                            {(wrap.author_name || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <span className="text-xs text-gray-600 dark:text-zinc-400 font-medium truncate">
                                {wrap.author_name}
                            </span>
                        </div>

                        {/* 下载量统计 */}
                        <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-[11px] font-bold text-gray-500 dark:text-zinc-400">
                                {wrap.download_count || 0}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
}
