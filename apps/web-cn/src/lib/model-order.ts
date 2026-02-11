type ModelLike = {
    slug?: string | null
    name?: string | null
    sort_order?: number | null
}

const PREFERRED_MODEL_ORDER = [
    'cybertruck',
    'model-3',
    'model-3-2024',
    'model-3-2024-performance',
    'model-y',
    'model-y-2025-premium',
    'model-y-2025-performance',
    'model-yl',
    'model-y-2025-standard',
] as const

const PREFERRED_RANK = new Map<string, number>(
    PREFERRED_MODEL_ORDER.map((slug, index) => [slug, index])
)

const SLUG_ALIAS_RANK: Record<string, number> = {
    'model-y-basic': PREFERRED_RANK.get('model-y-2025-standard') ?? 8,
    'model-y-standard': PREFERRED_RANK.get('model-y-2025-standard') ?? 8,
    'model-y-2025-basic': PREFERRED_RANK.get('model-y-2025-standard') ?? 8,
    'model-y-l': PREFERRED_RANK.get('model-yl') ?? 7,
    'model-y-long': PREFERRED_RANK.get('model-yl') ?? 7,
}

function rankBySlug(slugRaw?: string | null): number {
    if (!slugRaw) return Number.POSITIVE_INFINITY
    const slug = slugRaw.toLowerCase().trim()

    if (PREFERRED_RANK.has(slug)) return PREFERRED_RANK.get(slug)!
    if (slug in SLUG_ALIAS_RANK) return SLUG_ALIAS_RANK[slug]

    if (slug.includes('cybertruck')) {
        return PREFERRED_RANK.get('cybertruck') ?? 0
    }

    if (slug.includes('model-3')) {
        if (slug.includes('performance')) return PREFERRED_RANK.get('model-3-2024-performance') ?? 3
        if (slug.includes('2024') || slug.includes('2025') || slug.includes('highland')) {
            return PREFERRED_RANK.get('model-3-2024') ?? 2
        }
        return PREFERRED_RANK.get('model-3') ?? 1
    }

    if (slug.includes('model-yl') || slug.includes('model-y-l')) {
        return PREFERRED_RANK.get('model-yl') ?? 7
    }

    if (slug.includes('model-y')) {
        if (slug.includes('performance')) return PREFERRED_RANK.get('model-y-2025-performance') ?? 6
        if (slug.includes('standard') || slug.includes('basic') || slug.includes('base')) {
            return PREFERRED_RANK.get('model-y-2025-standard') ?? 8
        }
        if (slug.includes('2025') || slug.includes('juniper') || slug.includes('plus') || slug.includes('premium')) {
            return PREFERRED_RANK.get('model-y-2025-premium') ?? 5
        }
        return PREFERRED_RANK.get('model-y') ?? 4
    }

    return Number.POSITIVE_INFINITY
}

function rankByName(nameRaw?: string | null): number {
    if (!nameRaw) return Number.POSITIVE_INFINITY
    const name = nameRaw.toLowerCase().replace(/\s+/g, '')

    if (name.includes('cybertruck')) return PREFERRED_RANK.get('cybertruck') ?? 0

    if (name.includes('model3') || name.includes('mode3')) {
        if (name.includes('performance')) return PREFERRED_RANK.get('model-3-2024-performance') ?? 3
        if (name.includes('焕新版') || name.includes('highland') || name.includes('2024') || name.includes('2025')) {
            return PREFERRED_RANK.get('model-3-2024') ?? 2
        }
        return PREFERRED_RANK.get('model-3') ?? 1
    }

    if (name.includes('modelyl') || name.includes('modeyl')) {
        return PREFERRED_RANK.get('model-yl') ?? 7
    }

    if (name.includes('modely') || name.includes('modey')) {
        if (name.includes('performance')) return PREFERRED_RANK.get('model-y-2025-performance') ?? 6
        if (name.includes('基础') || name.includes('base') || name.includes('basic') || name.includes('standard')) {
            return PREFERRED_RANK.get('model-y-2025-standard') ?? 8
        }
        if (name.includes('焕新版') || name.includes('juniper') || name.includes('2025') || name.includes('plus') || name.includes('premium')) {
            return PREFERRED_RANK.get('model-y-2025-premium') ?? 5
        }
        return PREFERRED_RANK.get('model-y') ?? 4
    }

    return Number.POSITIVE_INFINITY
}

function getModelRank(model: ModelLike): number {
    const slugRank = rankBySlug(model.slug)
    if (Number.isFinite(slugRank)) return slugRank
    return rankByName(model.name)
}

export function sortModelsByPreferredOrder<T extends ModelLike>(models: T[]): T[] {
    return [...models]
        .map((model, index) => ({
            model,
            index,
            rank: getModelRank(model),
        }))
        .sort((a, b) => {
            if (a.rank !== b.rank) return a.rank - b.rank

            const aSort = typeof a.model.sort_order === 'number' ? a.model.sort_order : Number.POSITIVE_INFINITY
            const bSort = typeof b.model.sort_order === 'number' ? b.model.sort_order : Number.POSITIVE_INFINITY
            if (aSort !== bSort) return aSort - bSort

            const aSlug = (a.model.slug || '').toLowerCase()
            const bSlug = (b.model.slug || '').toLowerCase()
            if (aSlug !== bSlug) return aSlug.localeCompare(bSlug)

            return a.index - b.index
        })
        .map((item) => item.model)
}
