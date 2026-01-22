import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ModelViewerClient } from '@/components/ModelViewerClient'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { DownloadButton } from '@/components/DownloadButton'
import { getWrap } from '@/lib/api'
import { getOptimizedImageUrl } from '@/lib/images'
import { createClient } from '@/utils/supabase/server'

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string, locale: string }>
}): Promise<Metadata> {
    const { slug, locale } = await params
    const supabase = await createClient()
    const wrap = await getWrap(slug, supabase)

    if (!wrap) {
        return {
            title: 'Wrap Not Found',
            description: 'The requested wrap could not be found.',
        }
    }

    const name = locale === 'en' ? wrap.name_en || wrap.name : wrap.name
    const description = locale === 'en'
        ? wrap.description_en || wrap.description || `Check out ${name} - a premium Tesla wrap design available at MyTesLab.`
        : wrap.description || `查看 ${name} - MyTesLab 提供的优质特斯拉车身贴图设计。`

    const title = `${name} | MyTesLab`
    const imageUrl = getOptimizedImageUrl(wrap.preview_url || wrap.texture_url, { width: 1200, quality: 85 })
    const absoluteImageUrl = imageUrl.startsWith('http')
        ? imageUrl
        : `https://myteslab.com${imageUrl}`

    return {
        title,
        description,
        alternates: {
            canonical: `/${locale}/wraps/${slug}`,
            languages: {
                en: `/en/wraps/${slug}`,
                zh: `/zh/wraps/${slug}`,
            },
        },
        openGraph: {
            title,
            description,
            url: `https://myteslab.com/${locale}/wraps/${slug}`,
            siteName: 'MyTesLab',
            images: [
                {
                    url: absoluteImageUrl,
                    width: 1200,
                    height: 630,
                    alt: name,
                },
            ],
            locale: locale === 'zh' ? 'zh_CN' : 'en_US',
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [absoluteImageUrl],
        },
        robots: {
            index: true,
            follow: true,
        },
    }
}

export default async function WrapDetailPage({
    params,
}: {
    params: Promise<{ slug: string, locale: string }>
}) {
    const { slug, locale } = await params
    const supabase = await createClient()
    const wrap = await getWrap(slug, supabase)
    const t = await getTranslations('Common')

    if (!wrap) {
        notFound()
    }

    const name = locale === 'en' ? wrap.name_en || wrap.name : wrap.name
    const description = locale === 'en' ? wrap.description_en || wrap.description : wrap.description

    // 获取模型 URL (通过代理解决 CORS)
    const modelUrl = wrap.model_3d_url || 'https://cdn.tewan.club/models/wraps/cybertruck/model.glb'
    const proxiedModelUrl = modelUrl.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(modelUrl)}` : modelUrl

    // 获取贴图 URL
    const textureUrl = wrap.texture_url
        ? (wrap.texture_url.startsWith('http') ? `/api/proxy?url=${encodeURIComponent(wrap.texture_url)}` : wrap.texture_url)
        : undefined

    return (
        <div className="flex flex-col min-h-screen">
            {/* Main Content */}
            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex-1 w-full">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-6 text-sm font-medium"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('back_to_home')}
                </Link>
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-10">
                    {/* 左侧: 3D 预览 */}
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                        <div className="relative w-full aspect-video lg:aspect-auto lg:h-[calc(100vh-280px)] min-h-[400px] max-h-[800px] bg-gray-50">
                            <ModelViewerClient
                                modelUrl={proxiedModelUrl}
                                textureUrl={textureUrl}
                                modelSlug={wrap.model_slug}
                                className="w-full h-full"
                            />
                        </div>
                    </div>

                    {/* 右侧: 详情信息栏 */}
                    <div className="flex flex-col gap-6">
                        {/* 核心作品卡片 */}
                        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col gap-8 transition-all hover:shadow-md">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${wrap.category === 'official'
                                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                                            : wrap.category === 'community'
                                                ? 'bg-purple-50 text-purple-600 border-purple-100'
                                                : 'bg-green-50 text-green-600 border-green-100'
                                        }`}>
                                        {wrap.category === 'official' ? 'Official' : wrap.category === 'community' ? 'AI Generated' : 'DIY Custom'}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        {wrap.download_count || 0}
                                    </span>
                                </div>
                                <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">
                                    {name}
                                </h1>
                                {description && (
                                    <p className="text-sm text-gray-500 leading-relaxed font-medium">
                                        {description}
                                    </p>
                                )}
                            </div>

                            {/* 作者信息与下载 */}
                            <div className="flex flex-col gap-6 pt-6 border-t border-gray-50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden ring-4 ring-gray-50 shrink-0 shadow-inner">
                                        {wrap.author_avatar_url ? (
                                            <img src={wrap.author_avatar_url} alt={wrap.author_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-lg font-bold">
                                                {(wrap.author_name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t('author') || 'DESIGNER'}</p>
                                        <p className="font-bold text-gray-900 truncate text-base">@{wrap.author_name || 'Anonymous'}</p>
                                    </div>
                                </div>

                                <DownloadButton
                                    wrapId={wrap.id}
                                    wrapName={name}
                                    wrapSlug={wrap.slug || wrap.id}
                                    locale={locale}
                                />
                            </div>
                        </article>

                        {/* AI 提示词卡片 - 仅 AI 生成时显示 */}
                        {wrap.category === 'community' && wrap.prompt && (
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm transition-all hover:shadow-md">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                                        AI Generation Prompt
                                    </p>
                                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">v1.2</span>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <p className="text-sm font-medium text-gray-600 italic leading-relaxed font-mono">
                                        "{wrap.prompt}"
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 原始贴图预览 */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Original Texture Design</p>
                            <div className="aspect-[2/1] bg-gray-50 rounded-xl overflow-hidden border border-gray-100 relative group cursor-zoom-in shadow-inner">
                                <img
                                    src={getOptimizedImageUrl(wrap.texture_url, { width: 600, quality: 80 })}
                                    alt="Texture Preview"
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                    <span className="text-white text-[10px] font-bold tracking-widest uppercase bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-xl">
                                        Texture View Only
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Product',
                        name,
                        description: description || `Premium Tesla wrap design - ${name}`,
                        image: wrap.preview_url || wrap.texture_url,
                        brand: {
                            '@type': 'Brand',
                            name: 'MyTesLab',
                        },
                        category: wrap.category,
                        offers: {
                            '@type': 'Offer',
                            price: '0',
                            priceCurrency: 'USD',
                            availability: 'https://schema.org/InStock',
                            url: `https://myteslab.com/${locale}/wraps/${slug}`,
                        },
                        aggregateRating: wrap.download_count > 0 ? {
                            '@type': 'AggregateRating',
                            ratingValue: '5',
                            reviewCount: wrap.download_count.toString(),
                        } : undefined,
                    }),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'BreadcrumbList',
                        itemListElement: [
                            {
                                '@type': 'ListItem',
                                position: 1,
                                name: 'Home',
                                item: `https://myteslab.com/${locale}`,
                            },
                            {
                                '@type': 'ListItem',
                                position: 2,
                                name: name,
                                item: `https://myteslab.com/${locale}/wraps/${slug}`,
                            },
                        ],
                    }),
                }}
            />
        </div>
    )
}
