import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ModelViewerClient } from '@/components/ModelViewerClient'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { DownloadButton } from '@/components/DownloadButton'
import { getWrap, getModels } from '@/lib/api'
import { getOptimizedImageUrl } from '@/lib/images'
import { createClient } from '@/utils/supabase/server'
import ResponsiveOSSImage from '@/components/image/ResponsiveOSSImage'
import { CategoryBadge } from '@/components/CategoryBadge'

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

    // 获取模型名称以增强标题 SEO
    const models = await getModels()
    const model = models.find(m => m.slug === wrap.model_slug)
    const modelName = model ? (locale === 'en' ? model.name_en || model.name : model.name) : ''

    const title = modelName
        ? (locale === 'en' ? `${name} Tesla ${modelName} Wrap Design - Free Download | MyTesLab` : `${name} - 特斯拉 ${modelName} 车身贴膜设计免费下载 | MyTesLab`)
        : (locale === 'en' ? `${name} Tesla Wrap Design - Free Download | MyTesLab` : `${name} - 特斯拉车身贴膜设计免费下载 | MyTesLab`)

    // 动态生成语意化描述以增强 SEO
    const getDynamicDescription = () => {
        if (locale === 'en') {
            if (wrap.description_en) return wrap.description_en;
            if (wrap.description) return wrap.description;

            const base = `Download the ${name} wrap design for your Tesla ${modelName || ''} for free.`
            const features = wrap.prompt ? ` Features ${wrap.prompt.split(',').slice(0, 3).join(', ')} aesthetic.` : ''
            const intent = ` High-quality 4K texture files with professional 3D visualization and preview.`
            return `${base}${features}${intent} Perfect for professional vinyl wrap customization.`
        } else {
            if (wrap.description) return wrap.description;

            const base = `免费下载并预览适用于特斯拉 ${modelName || ''} 的 ${name} 车身贴膜设计方案。`
            const features = wrap.prompt ? `包含 ${wrap.prompt.split(',').slice(0, 3).join('、')} 等风格元素。` : ''
            const intent = `提供高质量原图下载与实时 3D 效果预览，是您定制爱车外观的理想模板方案。`
            return `${base}${features}${intent} 专业级车身改色设计，一键获取贴图纹理。`
        }
    }

    const description = getDynamicDescription()

    const imageUrl = getOptimizedImageUrl(wrap.preview_url || wrap.texture_url, { width: 1200, quality: 85 })
    const absoluteImageUrl = imageUrl.startsWith('http')
        ? imageUrl
        : `https://myteslab.com${imageUrl}`

    // 质量准入机制：只要是公开且生效的贴图，就允许索引
    const shouldIndex = wrap.is_active !== false && wrap.is_public === true

    return {
        title,
        description,
        alternates: {
            canonical: `/${locale}/wraps/${slug}`,
            languages: {
                en: `/en/wraps/${slug}`,
                zh: `/zh/wraps/${slug}`,
                'x-default': `/wraps/${slug}`,
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
            index: shouldIndex,
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

    // 获取模型名称以增强标题和结构化数据 SEO
    const models = await getModels()
    const model = models.find(m => m.slug === wrap.model_slug)
    const modelName = model ? (locale === 'en' ? model.name_en || model.name : model.name) : ''

    const imageUrl = getOptimizedImageUrl(wrap.preview_url || wrap.texture_url, { width: 1200, quality: 85 })
    const absoluteImageUrl = imageUrl.startsWith('http')
        ? imageUrl
        : `https://myteslab.com${imageUrl}`

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
                <div className="flex flex-wrap items-center gap-4 mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium mr-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        {t('back_to_home')}
                    </Link>

                    <div className="w-px h-4 bg-gray-200 dark:bg-zinc-800 hidden sm:block"></div>

                    {/* Visible Breadcrumbs for SEO and UX */}
                    <nav className="flex items-center gap-2 text-xs font-medium text-gray-400">
                        <Link href="/" className="hover:text-blue-600 transition-colors">{locale === 'en' ? 'Home' : '首页'}</Link>
                        <span>/</span>
                        {wrap.model_slug && (
                            <>
                                <Link href={`/models/${wrap.model_slug}`} className="hover:text-blue-600 transition-colors">
                                    {modelName}
                                </Link>
                                <span>/</span>
                            </>
                        )}
                        <span className="text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{name}</span>
                    </nav>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-10 items-start">
                    {/* 左侧: 3D 预览 */}
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                        <div className="relative w-full aspect-[4/3] lg:aspect-video bg-gray-50">
                            <ModelViewerClient
                                modelUrl={proxiedModelUrl}
                                textureUrl={textureUrl}
                                modelSlug={wrap.model_slug}
                                className="w-full h-full"
                            />
                        </div>
                    </div>

                    {/* 右侧: 详情信息栏 */}
                    <div className="flex flex-col gap-4">
                        {/* 核心信息与下载区域 (简约化：移除了背景卡片) */}
                        <div className="flex flex-col gap-8">
                            {/* 标题，标签与作者 */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <CategoryBadge category={wrap.category} />
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        {wrap.download_count || 0}
                                    </span>
                                </div>

                                <h1 className="text-xl lg:text-2xl font-black text-gray-900 tracking-tight">
                                    {name}
                                </h1>

                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden ring-2 ring-gray-50 shrink-0">
                                        {wrap.author_avatar_url ? (
                                            <img src={wrap.author_avatar_url} alt={wrap.author_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs font-bold">
                                                {(wrap.author_name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">@{wrap.author_name || 'Anonymous'}</div>
                                </div>
                            </div>

                            {/* Dynamic SEO Description Section (Hidden for users, visible for SEO) */}
                            <div className="sr-only" aria-hidden="true">
                                <h2>{locale === 'en' ? 'About this Tesla Wrap Design' : '关于这款特斯拉贴膜设计'}</h2>
                                <p>
                                    {locale === 'en'
                                        ? wrap.description_en || wrap.description || `This custom Tesla ${modelName || ''} wrap design, named "${name}", is available for free download. It provides a unique aesthetic for your vehicle with high-precision 4K texture patterns. Preview it in real-time using our 3D visualization studio before applying it to your car.`
                                        : wrap.description || `这款名为“${name}”的定制特斯拉 ${modelName || ''} 车身贴膜设计现在可以免费下载。它通过高精度 4K 纹理图案为您提供独特的外观方案。在正式施工前，您可以使用我们的 3D 可视化工作室进行实时效果预览。`}
                                </p>
                            </div>

                            {/* 贴图预览 (完整展示，不裁切) */}
                            <div className="bg-gray-50 rounded-xl border border-gray-100 p-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Texture Preview</p>
                                <div className="w-full bg-white rounded-lg overflow-hidden relative group shadow-inner">
                                    <ResponsiveOSSImage
                                        src={wrap.texture_url}
                                        alt={`${name} Tesla ${modelName || ''} wrap design texture pattern`}
                                        width={600}
                                        height={450}
                                        className="w-full h-auto max-h-[180px] object-contain mx-auto"
                                    />
                                    {/* 放大遮罩 */}
                                    <a
                                        href={getOptimizedImageUrl(wrap.texture_url, { width: 1600 })}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[1px]"
                                    >
                                        <span className="text-white text-[10px] font-bold tracking-widest uppercase bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                            View Original
                                        </span>
                                    </a>
                                </div>
                            </div>

                            {/* 下载按钮 */}
                            <div>
                                <DownloadButton
                                    wrapId={wrap.id}
                                    wrapName={name}
                                    wrapSlug={wrap.slug || wrap.id}
                                    locale={locale}
                                />
                            </div>

                            {/* 描述 */}
                            {description && (
                                <div className="pt-4 border-t border-gray-50">
                                    <p className="text-sm text-gray-500 leading-relaxed font-medium">
                                        {description}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* AI 提示词卡片 */}
                        {wrap.category === 'ai_generated' && wrap.prompt && (
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                                        AI Prompt
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/50">
                                    <p className="text-xs font-medium text-gray-600 italic leading-relaxed font-mono">
                                        "{wrap.prompt}"
                                    </p>
                                </div>
                            </div>
                        )}
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
                        name: `${name} - Tesla ${modelName || ''} Wrap Design`,
                        description: description || `Premium Tesla wrap design - ${name}`,
                        image: {
                            '@type': 'ImageObject',
                            url: absoluteImageUrl,
                            name: `${name} Tesla ${modelName || ''} wrap design premium texture`,
                            caption: `Free high-resolution download of ${name} wrap design for Tesla ${modelName || ''}. Visualize your next custom Tesla skin in 3D.`,
                            license: 'https://myteslab.com/terms',
                            acquireLicensePage: 'https://myteslab.com/terms',
                            creator: {
                                '@type': 'Organization',
                                name: 'MyTesLab'
                            }
                        },
                        brand: {
                            '@type': 'Brand',
                            name: 'MyTesLab',
                        },
                        category: wrap.category === 'official' ? 'Official Parts' : 'Custom Graphics',
                        sku: wrap.id,
                        offers: {
                            '@type': 'Offer',
                            price: '0',
                            priceCurrency: 'USD',
                            availability: 'https://schema.org/InStock',
                            url: `https://myteslab.com/${locale}/wraps/${slug}`,
                            seller: {
                                '@type': 'Organization',
                                name: 'MyTesLab',
                            },
                        },
                        aggregateRating: wrap.download_count > 0 ? {
                            '@type': 'AggregateRating',
                            ratingValue: '5',
                            reviewCount: Math.max(1, wrap.download_count).toString(),
                            bestRating: '5',
                            worstRating: '1',
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
                                name: locale === 'en' ? 'Home' : '首页',
                                item: `https://myteslab.com/${locale}`,
                            },
                            ...(wrap.model_slug ? [{
                                '@type': 'ListItem',
                                position: 2,
                                name: modelName,
                                item: `https://myteslab.com/${locale}/models/${wrap.model_slug}`,
                            }] : []),
                            {
                                '@type': 'ListItem',
                                position: wrap.model_slug ? 3 : 2,
                                name: name,
                                item: `https://myteslab.com/${locale}/wraps/${slug}`,
                            },
                        ],
                    }),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'FAQPage',
                        mainEntity: [
                            {
                                '@type': 'Question',
                                name: locale === 'en' ? 'How do I download and use this Tesla wrap design?' : '如何下载并使用此特斯拉贴膜设计？',
                                acceptedAnswer: {
                                    '@type': 'Answer',
                                    text: locale === 'en'
                                        ? 'You can download the high-resolution texture file directly by clicking the "Download" button. Once downloaded, you can provide this file to your local professional wrap shop for installation.'
                                        : '您可以点击“下载”按钮直接获取高分辨率纹理文件。下载后，您可以将此文件提供给当地专业的专业贴膜店进行施工安装。',
                                },
                            },
                            {
                                '@type': 'Question',
                                name: locale === 'en' ? 'Is this Tesla wrap design free to use?' : '这个特斯拉贴膜设计是免费的吗？',
                                acceptedAnswer: {
                                    '@type': 'Answer',
                                    text: locale === 'en'
                                        ? 'Yes, all designs in our community and official gallery are free to download and use for your personal Tesla customization.'
                                        : '是的，我们社区和官方库中的所有设计均可免费下载并用于您的个人特斯拉定制。',
                                },
                            },
                            {
                                '@type': 'Question',
                                name: locale === 'en' ? 'Which Tesla models are supported?' : '支持哪些特斯拉车型？',
                                acceptedAnswer: {
                                    '@type': 'Answer',
                                    text: locale === 'en'
                                        ? 'We support major Tesla models including Model 3, Model Y, Cybertruck, Model S, and Model X with specialized 3D visualization.'
                                        : '我们支持主要的特斯拉车型，包括 Model 3、Model Y、Cybertruck、Model S 和 Model X，并提供专门的 3D 可视化预览。',
                                },
                            }
                        ],
                    }),
                }}
            />
        </div>
    )
}
