import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ModelViewer } from '@/components/ModelViewer'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { DownloadButton } from '@/components/DownloadButton'
import { getWrap } from '@/lib/api'
import { getOptimizedImageUrl } from '@/lib/images'

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string, locale: string }>
}): Promise<Metadata> {
    const { slug, locale } = await params
    const wrap = await getWrap(slug)

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
    const imageUrl = getOptimizedImageUrl(wrap.preview_image_url || wrap.image_url, { width: 1200, quality: 85 })
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
    const wrap = await getWrap(slug)
    const t = await getTranslations('Common')

    if (!wrap) {
        notFound()
    }

    const name = locale === 'en' ? wrap.name_en || wrap.name : wrap.name
    const description = locale === 'en' ? wrap.description_en || wrap.description : wrap.description

    // 获取模型 URL (通过代理解决 CORS)
    const modelUrl = wrap.model_3d_url || 'https://cdn.tewan.club/models/wraps/cybertruck/model.glb'
    const proxiedModelUrl = `/api/proxy?url=${encodeURIComponent(modelUrl)}`

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {t('back_to_home')}
                        </Link>
                        <LanguageSwitcher />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
                    {/* 左侧: 3D 预览 */}
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <div className="relative w-full aspect-square sm:aspect-[4/3] bg-gray-100">
                            <ModelViewer
                                modelUrl={proxiedModelUrl}
                                textureUrl={wrap.wrap_image_url || wrap.image_url ? `/api/proxy?url=${encodeURIComponent(wrap.wrap_image_url || wrap.image_url)}` : undefined}
                                modelSlug={wrap.model_slug}
                                className="w-full h-full"
                            />
                        </div>
                    </div>

                    {/* 右侧: 贴图信息 */}
                    <div className="space-y-6">
                        {/* 基本信息 */}
                        <article className="bg-white rounded-lg shadow-lg p-6">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                {name}
                            </h1>

                            {description && (
                                <p className="text-gray-600 mb-4">
                                    {description}
                                </p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    {wrap.category}
                                </span>

                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    {wrap.download_count || 0} {locale === 'zh' ? '次下载' : 'downloads'}
                                </span>
                            </div>
                        </article>

                        {/* 下载按钮 */}
                        <DownloadButton
                            wrapId={wrap.id}
                            wrapName={name}
                            wrapSlug={wrap.slug}
                            locale={locale}
                        />
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
                        image: wrap.preview_image_url || wrap.image_url,
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
