import { getTranslations } from 'next-intl/server'
import { WrapList } from '@/components/WrapList'
import { FilterBarWrapper } from '@/components/FilterBarWrapper'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import AuthButton from '@/components/auth/AuthButton'
import { getWraps, getModels } from '@/lib/api'

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
      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex-1 w-full">
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
            url: 'https://myteslab.com',
            logo: 'https://myteslab.com/og-image.png',
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
            url: `https://myteslab.com/${locale}`,
            description: locale === 'en'
              ? 'Visualize your next look: The ultimate studio for custom Tesla wrap designs.'
              : '为您的特斯拉可视化下一个造型：终极定制车身贴图设计工作室。',
            inLanguage: locale === 'zh' ? 'zh-CN' : 'en-US',
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `https://myteslab.com/${locale}?model={search_term_string}`
              },
              'query-input': 'required name=search_term_string'
            }
          }),
        }}
      />
    </div>
  )
}
