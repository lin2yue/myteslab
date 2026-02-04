import { getWraps } from '@/lib/api'
import { WrapCard } from './WrapCard'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'

interface RelatedWrapsProps {
    modelSlug: string
    currentWrapSlug: string
    locale: string
}

export async function RelatedWraps({ modelSlug, currentWrapSlug, locale }: RelatedWrapsProps) {
    const t = await getTranslations('Index')
    const tCom = await getTranslations('Common')

    // 获取同车型的热门贴膜（取前12个用于筛选）
    // 注意：getWraps 返回的是 Promise<Wrap[]>
    const allWraps = await getWraps(modelSlug, 1, 12, 'popular')

    // 排除当前正在查看的贴膜，并取前 5 个展示
    const relatedWraps = allWraps
        .filter(w => w.slug !== currentWrapSlug)
        .slice(0, 5)

    if (relatedWraps.length === 0) return null

    return (
        <section className="mt-16 pt-16 pb-20 border-t border-gray-100 dark:border-zinc-800 container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    {locale === 'en' ? 'More Recommended Designs' : '更多推荐设计'}
                </h2>
                <Link
                    href={`/models/${modelSlug}`}
                    className="text-sm font-bold text-gray-500 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
                >
                    {t('view_all')}
                    <i className="fi fi-rr-arrow-right text-[10px]"></i>
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {relatedWraps.map((wrap) => (
                    <WrapCard key={wrap.id} wrap={wrap} />
                ))}
            </div>
        </section>
    )
}
