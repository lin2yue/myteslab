import Image from 'next/image'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/routing'
import type { Wrap } from '@/lib/types'
import { getOptimizedImageUrl } from '@/lib/images'

interface WrapCardProps {
    wrap: Wrap
}

export function WrapCard({ wrap }: WrapCardProps) {
    const locale = useLocale()
    const name = locale === 'en' ? wrap.name_en || wrap.name : wrap.name
    const description = locale === 'en' ? wrap.description_en || wrap.description : wrap.description

    return (
        <Link href={`/wraps/${wrap.slug}`}>
            <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden group">
                {/* 预览图 */}
                <div className="aspect-[4/3] relative bg-gray-100">
                    {wrap.preview_image_url ? (
                        <Image
                            src={getOptimizedImageUrl(wrap.preview_image_url, { width: 800, quality: 80 })}
                            alt={name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* 信息 */}
                <div className="p-4">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {name}
                    </h3>

                    {description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {description}
                        </p>
                    )}

                    <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded uppercase">
                                {wrap.category}
                            </span>
                            {wrap.author_name && (
                                <span className="text-[10px] text-blue-500 font-medium">
                                    @{wrap.author_name}
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            {wrap.download_count || 0}
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    )
}
