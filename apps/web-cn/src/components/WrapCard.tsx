import Image from 'next/image'
import { useLocale } from '@/lib/i18n'
import Link from 'next/link'
import type { Wrap } from '@/lib/types'
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage'

interface WrapCardProps {
    wrap: Wrap
}

export function WrapCard({ wrap }: WrapCardProps) {
    const locale = useLocale()
    const displayDownloadCount = wrap.user_download_count ?? wrap.download_count ?? 0;
    const name = locale === 'en' ? wrap.name_en || wrap.name : wrap.name;
    const modelDisplay = locale === 'en'
        ? wrap.model_name_en || wrap.model_name || (wrap.category === 'official' ? 'Official' : 'Custom')
        : wrap.model_name || (wrap.category === 'official' ? '官方作品' : '自定义');

    const wrapSlug = wrap.slug || wrap.id;

    return (
        <Link href={`/wraps/${wrapSlug}`}>
            <div className="bg-white/80 dark:bg-zinc-900/80 rounded-2xl overflow-hidden shadow-none hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_16px_36px_rgba(0,0,0,0.10)] transition-all duration-300 group border border-black/5 dark:border-white/10 flex flex-col h-full backdrop-blur-sm hover:-translate-y-0.5">
                {/* 预览图容器 */}
                <div className="aspect-[4/3] relative bg-gray-50 overflow-hidden">
                    {wrap.preview_image_url ? (
                        <ResponsiveOSSImage
                            src={wrap.preview_image_url}
                            alt={wrap.prompt
                                ? `${name} Tesla ${modelDisplay} wrap - ${wrap.prompt.slice(0, 80)}...`
                                : `${name} Tesla ${modelDisplay} wrap design skin`
                            }
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

                    {/* Hover 提示：保持整卡可点击，不单独拦截事件 */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
                        <span
                            aria-hidden="true"
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/55 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3.25L4 7.5 12 11.75 20 7.5 12 3.25Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7.5V16.5L12 20.75V11.75" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7.5V16.5L12 20.75" />
                            </svg>
                            {locale === 'en' ? '3D Preview' : '3D预览'}
                        </span>
                    </div>
                </div>

                {/* 内容区域 */}
                <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-zinc-100 group-hover:text-gray-900 transition-colors line-clamp-1 text-base mb-3">
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
                                {displayDownloadCount}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
}
