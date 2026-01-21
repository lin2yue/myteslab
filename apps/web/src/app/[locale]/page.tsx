import { getTranslations } from 'next-intl/server'
import { WrapList } from '@/components/WrapList'
import { FilterBarWrapper } from '@/components/FilterBarWrapper'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import AuthButton from '@/components/auth/AuthButton'
import { getWraps, getModels } from '@/lib/api'

import { Link } from '@/i18n/routing'
export const revalidate = 0 // 禁用静态缓存，确保首页数据即时刷新

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
      <main className="max-w-7xl mx-auto px-4 py-8">
        <FilterBarWrapper models={models} sortBy={sortBy}>
          <WrapList initialWraps={wraps} model={model} locale={locale} sortBy={sortBy} />
        </FilterBarWrapper>
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Tesla Studio - Powered by Next.js + Supabase</p>
        </div>
      </footer>

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
          }),
        }}
      />
    </div>
  )
}
