import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { WrapList } from '@/components/WrapList'
import { FilterBarWrapper } from '@/components/FilterBarWrapper'
import { getWraps, getModels } from '@/lib/api'
import { Link } from '@/i18n/routing'
import { notFound } from 'next/navigation'

export const revalidate = 60 // Enable ISR

export async function generateMetadata({
    params
}: {
    params: Promise<{ locale: string, slug: string }>
}): Promise<Metadata> {
    const { locale, slug } = await params
    const models = await getModels()
    const tModels = await getTranslations({ locale, namespace: 'Models' })
    const model = models.find(m => m.slug === slug)

    if (!model) {
        return {
            title: 'Model Not Found',
        }
    }

    const modelName = locale === 'en' ? model.name_en || model.name : model.name
    const title = locale === 'en'
        ? `${modelName} Free Tesla Wrap Designs & Download | 3D Visualization | MyTesLab`
        : `特斯拉 ${modelName} 车身贴膜设计免费下载与 3D 预览 | MyTesLab`

    const description = tModels(`${slug}.description`) || (locale === 'en'
        ? `Browse and download the best free custom wrap designs for Tesla ${modelName}. Preview 3D wraps and find inspiration for your next look.`
        : `浏览并免费下载最优秀的特斯拉 ${modelName} 定制车身贴图设计。实时 3D 预览，为您的爱车寻找下一个造型灵感。`)

    return {
        title,
        description,
        alternates: {
            canonical: `/models/${slug}`,
            languages: {
                en: `/en/models/${slug}`,
                zh: `/zh/models/${slug}`,
            },
        },
        openGraph: {
            title,
            description,
            url: `https://myteslab.com/${locale}/models/${slug}`,
            siteName: 'MyTesLab',
            images: [
                {
                    url: '/og-image.png',
                    width: 1200,
                    height: 630,
                    alt: `Tesla ${modelName} Wraps`,
                },
            ],
            locale: locale === 'zh' ? 'zh_CN' : 'en_US',
            type: 'website',
        },
    }
}

export default async function ModelPage({
    params,
    searchParams
}: {
    params: Promise<{ locale: string, slug: string }>
    searchParams: Promise<{ sort?: string }>
}) {
    const { locale, slug } = await params
    const { sort } = await searchParams
    const sortBy = (sort as 'latest' | 'popular') || 'latest'

    const [wraps, models] = await Promise.all([
        getWraps(slug, 1, 12, sortBy),
        getModels(),
    ])

    const currentModel = models.find(m => m.slug === slug)
    if (!currentModel) {
        notFound()
    }

    const t = await getTranslations('Index')
    const tModels = await getTranslations('Models')

    return (
        <div className="flex flex-col">
            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex-1 w-full">
                {/* 增加页面标题，对 SEO 有利 */}
                <h1 className="sr-only">
                    {locale === 'en'
                        ? `Free Tesla ${currentModel.name_en || currentModel.name} Wrap Designs and 3D Visualization`
                        : `特斯拉 ${currentModel.name} 车身贴膜设计免费下载与 3D 预览`}
                </h1>

                <FilterBarWrapper models={models} sortBy={sortBy}>
                    <WrapList initialWraps={wraps} model={slug} locale={locale} sortBy={sortBy} />
                </FilterBarWrapper>
            </main>
        </div>
    )
}
