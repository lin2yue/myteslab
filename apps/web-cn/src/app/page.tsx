import { getTranslations } from '@/lib/i18n'
import { WrapList } from '@/components/WrapList'
import { FilterBarWrapper } from '@/components/FilterBarWrapper'
import { getWraps, getModels, getWrapKeywordSuggestions, type WrapSortBy } from '@/lib/api'
import { getModelDisplayName } from '@/lib/model-display'
import { HomeOperationModal } from '@/components/operations/HomeOperationModal'
import { HomeOperationBanner } from '@/components/operations/HomeOperationBanner'

export const revalidate = 60 // 启用 ISR 缓存，每 60 秒刷新一次，提升首页响应速度

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<{ model?: string, sort?: string, search?: string }>
}) {
    const t = await getTranslations('Index')
    const { model, sort, search } = await searchParams

    const sortBy: WrapSortBy = sort === 'popular' || sort === 'latest' || sort === 'recommended'
        ? sort
        : 'recommended'
    const searchQuery = (search || '').trim()

    const [wraps, models, recommendedKeywords] = await Promise.all([
        getWraps(model, 1, 15, sortBy, searchQuery),
        getModels(),
        getWrapKeywordSuggestions(model, 'zh'),
    ])

    return (
        <div className="flex flex-col">
            {/* Main Content */}
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 flex-1 w-full">
                {/* SEO Hero Section */}
                <section className="mb-8 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
                        特斯拉喷漆车间涂装免费下载与 AI 设计平台
                    </h1>
                    <p className="text-gray-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
                        {t('welcome_desc')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-zinc-500 max-w-4xl mx-auto mt-4 leading-7">
                        特玩专注提供特斯拉涂装下载、特斯拉喷漆车间素材、车机皮肤与自定义贴膜设计，覆盖 Model 3、Model Y、Cybertruck、Model S、Model X，支持 AI 生成与 3D 预览后再下载导入车机。
                    </p>
                </section>
                <HomeOperationBanner />

                <section className="mb-8 rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-6 md:p-8">
                    <div className="grid gap-6 md:grid-cols-3 text-left">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">热门搜索入口</h2>
                            <ul className="space-y-2 text-sm text-gray-600 dark:text-zinc-400">
                                <li>特斯拉涂装下载</li>
                                <li>特斯拉喷漆车间素材</li>
                                <li>特斯拉车机皮肤下载</li>
                                <li>特斯拉自定义涂装与 AI 设计</li>
                            </ul>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">支持车型</h2>
                            <p className="text-sm text-gray-600 dark:text-zinc-400 leading-7">
                                支持 Model 3、Model Y、Cybertruck、Model S、Model X，不同车型页可直接查看适配的喷漆车间贴膜与下载素材。
                            </p>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">使用方式</h2>
                            <p className="text-sm text-gray-600 dark:text-zinc-400 leading-7">
                                先浏览社区涂装或用 AI 生成设计，再通过 3D 预览确认效果，最后下载 PNG 贴图导入 Tesla Toybox Paint Shop / 喷漆车间使用。
                            </p>
                        </div>
                    </div>
                </section>

                <FilterBarWrapper models={models} sortBy={sortBy} recommendedKeywords={recommendedKeywords}>
                    <WrapList initialWraps={wraps} model={model} locale="zh" sortBy={sortBy} searchQuery={searchQuery} />
                </FilterBarWrapper>

                <section className="mt-12 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">为什么特玩适合特斯拉喷漆车间 SEO 关键词用户</h2>
                        <div className="space-y-3 text-sm leading-7 text-gray-600 dark:text-zinc-400">
                            <p>我们不是单纯图片站，而是围绕“特斯拉涂装下载、喷漆车间素材、车机皮肤导入、AI 生成设计、3D 预览”形成完整链路，能覆盖搜索用户从找素材到实际下载使用的全过程。</p>
                            <p>首页负责收口核心词，车型页负责承接 Model 3 / Model Y 等中频词，具体作品详情页负责承接长尾风格词，这样搜索引擎更容易理解站点结构与页面意图。</p>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">常见问题</h2>
                        <div className="space-y-4 text-sm leading-7 text-gray-600 dark:text-zinc-400">
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white">特斯拉喷漆车间素材可以免费下载吗？</h3>
                                <p>大部分公开涂装作品可以直接浏览与下载，适合导入 Tesla Toybox Paint Shop 使用。</p>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white">支持哪些车型？</h3>
                                <p>当前重点支持 Model 3、Model Y、Cybertruck、Model S、Model X，并持续扩充适配模型与贴图。</p>
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white">能不能先预览再下载？</h3>
                                <p>可以。每个核心页面都尽量提供 3D 预览与筛选能力，降低下载前试错成本。</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <HomeOperationModal />

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
                                urlTemplate: `https://tewan.club?search={search_term_string}`
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
