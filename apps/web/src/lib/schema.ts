import { Wrap } from './types'

/**
 * 生成组织 Schema (Organization)
 */
export function generateOrganizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'MyTesLab',
        url: 'https://www.myteslab.com',
        logo: 'https://www.myteslab.com/og-image.png',
        description: 'The ultimate studio for custom Tesla wrap designs',
        sameAs: [
            // 后续可以添加社交媒体链接
            // 'https://twitter.com/myteslab',
            // 'https://facebook.com/myteslab',
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
        name: 'MyTesLab',
        url: `https://www.myteslab.com/${locale}`,
        description: locale === 'en'
            ? 'Visualize your next look: The ultimate studio for custom Tesla wrap designs.'
            : '为您的特斯拉可视化下一个造型：终极定制车身贴图设计工作室。',
        inLanguage: locale === 'zh' ? 'zh-CN' : 'en-US',
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `https://www.myteslab.com/${locale}?search={search_term_string}`,
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
    const displayDownloadCount = wrap.user_download_count ?? wrap.download_count ?? 0
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
            name: 'MyTesLab',
        },
        category: wrap.category,
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            url: `https://www.myteslab.com/${locale}/wraps/${wrap.slug}`,
        },
        aggregateRating: displayDownloadCount > 0 ? {
            '@type': 'AggregateRating',
            ratingValue: '5',
            reviewCount: displayDownloadCount.toString(),
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
