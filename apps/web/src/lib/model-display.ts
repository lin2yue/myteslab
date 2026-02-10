import type { Model } from '@/lib/types'

export function formatModelSlug(slug?: string): string {
    if (!slug) return ''
    return slug.replace(/-/g, ' ')
}

export function getModelDisplayName(options: {
    slug?: string
    locale?: string
    modelName?: string
    modelNameEn?: string
    models?: Array<Pick<Model, 'slug' | 'name' | 'name_en'>>
}): string {
    const {
        slug,
        locale,
        modelName,
        modelNameEn,
        models
    } = options

    const isEn = (locale || '').startsWith('en')

    if (isEn) {
        if (modelNameEn) return modelNameEn
        if (modelName) return modelName
    } else {
        if (modelName) return modelName
        if (modelNameEn) return modelNameEn
    }

    if (slug && models && models.length > 0) {
        const found = models.find(m => m.slug === slug)
        if (found) {
            if (isEn) return found.name_en || found.name
            return found.name || found.name_en || ''
        }
    }

    return formatModelSlug(slug)
}

export function createModelNameResolver(
    models: Array<Pick<Model, 'slug' | 'name' | 'name_en'>>,
    locale?: string
) {
    const isEn = (locale || '').startsWith('en')
    const map = new Map<string, string>()
    models.forEach((m) => {
        const name = isEn ? (m.name_en || m.name) : (m.name || m.name_en || '')
        if (name) map.set(m.slug, name)
    })

    return (slug: string | undefined) => {
        if (!slug) return ''
        return map.get(slug) || formatModelSlug(slug)
    }
}
