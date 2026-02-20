import { getTranslations } from '@/lib/i18n'
import { WrapList } from '@/components/WrapList'
import { FilterBarWrapper } from '@/components/FilterBarWrapper'
import { getWraps, getModels } from '@/lib/api'
import { getModelDisplayName } from '@/lib/model-display'

export const revalidate = 60 // 启用 ISR 缓存，每 60 秒刷新一次，提升首页响应速度

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<{ model?: string, sort?: string }>
}) {
    const t = await getTranslations('Index')
    const { model, sort } = await searchParams

    const sortBy = (sort as 'latest' | 'popular') || 'latest'

    const [wraps, models] = await Promise.all([
        getWraps(model, 1, 15, sortBy),
        getModels(),
    ])

    return (
        <div className="flex flex-col">
            {/* SEO H1 - Hidden but accessible */}
            <h1 className="sr-only">
                特斯拉改色设计库 - 免费 AI 设计工具与 3D 预览
            </h1>

            {/* Main Content */}
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 flex-1 w-full">
                {/* SEO Hero Section */}
                <section className="mb-8 text-center">
                    <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
                        {t('welcome')}
                    </h2>
                    <p className="text-gray-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
                        {t('welcome_desc')}
                    </p>
                </section>

                <FilterBarWrapper models={models} sortBy={sortBy}>
                    <WrapList initialWraps={wraps} model={model} locale="zh" sortBy={sortBy} />
                </FilterBarWrapper>
            </main>

            {/* Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Organization',
                        name: '特玩',
                        url: 'https://tewan.club',
                        logo: 'https://tewan.club/og-image.png',
                        description: '终极特斯拉定制车身贴图设计工作室',
                    }),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'WebSite',
                        name: '特玩',
                        url: `https://tewan.club`,
                        description: '为您的特斯拉可视化下一个造型:终极定制车身贴图设计工作室。',
                        inLanguage: 'zh-CN',
                        potentialAction: {
                            '@type': 'SearchAction',
                            target: {
                                '@type': 'EntryPoint',
                                urlTemplate: `https://tewan.club?model={search_term_string}`
                            },
                            'query-input': 'required name=search_term_string'
                        }
                    }),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'ItemList',
                        name: '特斯拉贴膜设计',
                        description: '精选特斯拉车身改色设计库，支持免费下载',
                        itemListElement: wraps.slice(0, 15).map((wrap, index) => ({
                            '@type': 'ListItem',
                            position: index + 1,
                            item: {
                                '@type': 'Product',
                                name: wrap.name,
                                image: wrap.preview_url || wrap.texture_url,
                                description: `适用于特斯拉 ${getModelDisplayName({ slug: wrap.model_slug, modelName: wrap.model_name, modelNameEn: wrap.model_name_en, locale: 'zh' })} 的 ${wrap.name} 贴膜设计`,
                                url: `https://tewan.club/wraps/${wrap.slug}`,
                                offers: {
                                    '@type': 'Offer',
                                    price: '0',
                                    priceCurrency: 'USD',
                                    availability: 'https://schema.org/InStock'
                                }
                            }
                        }))
                    }),
                }}
            />
        </div>
    )
}
