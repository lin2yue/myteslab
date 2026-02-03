import { getTranslations } from 'next-intl/server'
import { WrapList } from '@/components/WrapList'
import { FilterBarWrapper } from '@/components/FilterBarWrapper'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import AuthButton from '@/components/auth/AuthButton'
import { getWraps, getModels } from '@/lib/api'
import { getModelDisplayName } from '@/lib/model-display'

import { Link } from '@/i18n/routing'
export const revalidate = 60 // 启用 ISR 缓存，每 60 秒刷新一次，提升首页响应速度

export default async function HomePage({
  searchParams,
  params
}: {
  searchParams: Promise<{ model?: string, sort?: string }>
  params: Promise<{ locale: string }>
}) {
  const t = await getTranslations('Index')
  const tCommon = await getTranslations('Common')
  const { model, sort } = await searchParams
  const { locale } = await params

  const sortBy = (sort as 'latest' | 'popular') || 'latest'

  const [wraps, models] = await Promise.all([
    getWraps(model, 1, 12, sortBy),
    getModels(),
  ])

  return (
    <div className="flex flex-col">
      {/* SEO H1 - Hidden but accessible */}
      <h1 className="sr-only">
        {locale === 'en'
          ? 'Tesla Wrap Design Library - Free AI Designer & 3D Preview'
          : '特斯拉改色设计库 - 免费 AI 设计工具与 3D 预览'
        }
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
          <WrapList initialWraps={wraps} model={model} locale={locale} sortBy={sortBy} />
        </FilterBarWrapper>
      </main>

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'MyTesLab',
            url: 'https://www.myteslab.com',
            logo: 'https://www.myteslab.com/og-image.png',
            description: locale === 'en'
              ? 'The ultimate studio for custom Tesla wrap designs'
              : '终极特斯拉定制车身贴图设计工作室',
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'MyTesLab',
            url: `https://www.myteslab.com/${locale}`,
            description: locale === 'en'
              ? 'Visualize your next look: The ultimate studio for custom Tesla wrap designs.'
              : '为您的特斯拉可视化下一个造型:终极定制车身贴图设计工作室。',
            inLanguage: locale === 'zh' ? 'zh-CN' : 'en-US',
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `https://www.myteslab.com/${locale}?model={search_term_string}`
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
            name: locale === 'en' ? 'Tesla Wrap Designs' : '特斯拉贴膜设计',
            description: locale === 'en'
              ? 'Premium Tesla wrap designs library, available for free download'
              : '精选特斯拉车身改色设计库，支持免费下载',
            itemListElement: wraps.slice(0, 12).map((wrap, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: {
                '@type': 'Product',
                name: wrap.name,
                image: wrap.preview_url || wrap.texture_url,
                description: locale === 'en'
                  ? `${wrap.name} wrap design for Tesla ${getModelDisplayName({ slug: wrap.model_slug, modelName: wrap.model_name, modelNameEn: wrap.model_name_en, locale })}`
                  : `适用于特斯拉 ${getModelDisplayName({ slug: wrap.model_slug, modelName: wrap.model_name, modelNameEn: wrap.model_name_en, locale })} 的 ${wrap.name} 贴膜设计`,
                url: `https://www.myteslab.com/${locale}/wraps/${wrap.slug}`,
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
