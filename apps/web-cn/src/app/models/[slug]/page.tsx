import { Metadata } from 'next'
import { getTranslations } from '@/lib/i18n'
import { WrapList } from '@/components/WrapList'
import { FilterBarWrapper } from '@/components/FilterBarWrapper'
import { getWraps, getModels } from '@/lib/api'
import { notFound } from 'next/navigation'

export const revalidate = 60 // Enable ISR

export async function generateMetadata({
    params
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params
    const locale = 'zh' as string
    const models = await getModels()
    const tModels = await getTranslations('Models')
    const model = models.find(m => m.slug === slug)

    if (!model) {
        return {
            title: 'Model Not Found',
        }
    }

    const modelName = locale === 'en' ? model.name_en || model.name : model.name
    const title = locale === 'en'
        ? `${modelName} Free Tesla Wrap Designs & Download | 3D Visualization | 特玩`
        : `特斯拉 ${modelName} 车身贴膜设计免费下载与 3D 预览 | 特玩`

    const descriptionFallback = locale === 'en'
        ? `Browse and download the best free custom wrap designs for Tesla ${modelName}. Preview 3D wraps and find inspiration for your next look.`
        : `浏览并免费下载最优秀的特斯拉 ${modelName} 定制车身贴图设计。实时 3D 预览，为您的爱车寻找下一个造型灵感。`
    let description = descriptionFallback
    try {
        description = tModels(`${slug}.description`)
    } catch {
        description = descriptionFallback
    }

    return {
        title,
        description,
        alternates: {
            canonical: `/models/${slug}`,
        },
        openGraph: {
            title,
            description,
            url: `https://tewan.club/models/${slug}`,
            siteName: '特玩',
            images: [
                {
                    url: '/og-image.png',
                    width: 1200,
                    height: 630,
                    alt: `Tesla ${modelName} Wraps`,
                },
            ],
            locale: 'zh_CN',
            type: 'website',
        },
    }
}

export default async function ModelPage({
    params,
    searchParams
}: {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ sort?: string }>
}) {
    const { slug } = await params
    const locale = 'zh' as string
    const { sort } = await searchParams
    const sortBy = (sort as 'latest' | 'popular') || 'latest'

    const [wraps, models] = await Promise.all([
        getWraps(slug, 1, 15, sortBy),
        getModels(),
    ])

    const currentModel = models.find(m => m.slug === slug)
    if (!currentModel) {
        notFound()
    }

    const t = await getTranslations('Index')
    const tModels = await getTranslations('Models')
    const descriptionFallback = locale === 'en'
        ? `Browse and download the best free custom wrap designs for Tesla ${currentModel.name_en || currentModel.name}. Preview 3D wraps and find inspiration for your next look.`
        : `浏览并免费下载最优秀的特斯拉 ${currentModel.name} 定制车身贴图设计。实时 3D 预览，为您的爱车寻找下一个造型灵感。`
    let modelDescription = descriptionFallback
    try {
        modelDescription = tModels(`${slug}.description`)
    } catch {
        modelDescription = descriptionFallback
    }

    return (
        <div className="flex flex-col">
            <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 flex-1 w-full">
                {/* 页面标题与描述：保持可见，避免切换车型时页面跳动 */}
                <section className="mb-8 text-center">
                    <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
                        {locale === 'en'
                            ? `Free Tesla ${currentModel.name_en || currentModel.name} Wrap Designs`
                            : `特斯拉 ${currentModel.name} 改色贴膜与涂装设计库`}
                    </h1>
                    <p className="text-gray-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
                        {modelDescription}
                    </p>
                </section>

                <FilterBarWrapper models={models} sortBy={sortBy}>
                    <WrapList initialWraps={wraps} model={slug} locale={locale} sortBy={sortBy} />
                </FilterBarWrapper>
            </main>
        </div>
    )
}
