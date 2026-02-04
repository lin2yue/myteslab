import { Wrap } from './types'

/**
 * 生成组织 Schema (Organization)
 */
export function generateOrganizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '特玩',
        url: 'https://tewan.club',
        logo: 'https://tewan.club/og-image.png',
        description: '特斯拉车身贴膜设计与 3D 预览平台',
        sameAs: [
            // 后续可以添加社交媒体链接
            // 'https://twitter.com/tewan',
            // 'https://facebook.com/tewan',
        ],
    }
}

/**
 * 生成网站 Schema (WebSite)
 */
export function generateWebSiteSchema(locale: string) {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '特玩',
        url: `https://tewan.club/${locale}`,
        description: '为您的特斯拉可视化下一个造型：终极定制车身贴图设计工作室。',
        inLanguage: 'zh-CN',
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `https://tewan.club/${locale}?search={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    }
}

/**
 * 生成产品 Schema (Product)
 */
export function generateProductSchema(wrap: Wrap, locale: string) {
    const name = locale === 'en' ? wrap.name_en || wrap.name : wrap.name
    const description = locale === 'en'
        ? wrap.description_en || wrap.description || `Premium Tesla wrap design - ${name}`
        : wrap.description || `优质特斯拉车身贴图 - ${name}`

    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name,
        description,
        image: wrap.preview_image_url || wrap.image_url,
        brand: {
            '@type': 'Brand',
            name: '特玩',
        },
        category: wrap.category,
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'CNY',
            availability: 'https://schema.org/InStock',
            url: `https://tewan.club/${locale}/wraps/${wrap.slug}`,
        },
        aggregateRating: wrap.download_count > 0 ? {
            '@type': 'AggregateRating',
            ratingValue: '5',
            reviewCount: wrap.download_count.toString(),
        } : undefined,
    }
}

/**
 * 生成面包屑导航 Schema (BreadcrumbList)
 */
export function generateBreadcrumbSchema(
    items: Array<{ name: string; url: string }>
) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    }
}

/**
 * 生成图片对象 Schema (ImageObject)
 */
export function generateImageObjectSchema(
    imageUrl: string,
    name: string,
    description?: string
) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ImageObject',
        url: imageUrl,
        name,
        description: description || name,
        contentUrl: imageUrl,
    }
}
