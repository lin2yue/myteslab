import { getTranslations } from 'next-intl/server'
import { WrapCard } from '@/components/WrapCard'
import { FilterBarWrapper } from '@/components/FilterBarWrapper'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { getWraps, getModels } from '@/lib/api'

export default async function HomePage({
  searchParams,
  params
}: {
  searchParams: Promise<{ model?: string }>
  params: Promise<{ locale: string }>
}) {
  const t = await getTranslations('Index')
  const { model } = await searchParams
  const { locale } = await params

  const wraps = await getWraps(model)
  const models = await getModels()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
              <p className="text-gray-600 mt-1">{t('description')}</p>
            </div>

            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <div className="text-sm text-gray-500">
                {wraps.length} {locale === 'zh' ? '个贴图' : 'wraps'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <FilterBarWrapper models={models}>
          {/* Wraps Grid */}
          {wraps.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {wraps.map((wrap) => (
                <WrapCard key={wrap.id} wrap={wrap} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎨</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t('no_wraps')}
              </h3>
              <p className="text-gray-600">
                {model ? (locale === 'zh' ? '该车型暂无可用贴图' : 'No wraps available for this model') : (locale === 'zh' ? '请先在数据库中添加贴图数据' : 'Please add wrap data to the database first')}
              </p>
            </div>
          )}
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
