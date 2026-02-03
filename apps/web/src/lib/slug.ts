import crypto from 'crypto'

export function slugify(input: string) {
    return input
        .toLowerCase()
        .trim()
        .replace(/['"]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
}

export function buildSlugBase({
    name,
    nameEn,
    prompt,
    modelSlug
}: {
    name?: string | null
    nameEn?: string | null
    prompt?: string | null
    modelSlug?: string | null
}) {
    const raw = nameEn || name || prompt || 'wrap'
    const base = slugify(raw)
    if (base) {
        return modelSlug ? `${modelSlug}-${base}` : base
    }
    const fallback = `wrap-${crypto.randomBytes(3).toString('hex')}`
    return modelSlug ? `${modelSlug}-${fallback}` : fallback
}

export async function ensureUniqueSlug(
    supabase: any,
    base: string,
    maxAttempts = 5
) {
    let candidate = base
    for (let i = 0; i < maxAttempts; i += 1) {
        const { data, error } = await supabase
            .from('wraps')
            .select('id')
            .eq('slug', candidate)
            .maybeSingle()
        if (error && error.code !== 'PGRST116') {
            throw error
        }
        if (!data) return candidate
        candidate = `${base}-${crypto.randomBytes(2).toString('hex')}`
    }
    return `${base}-${crypto.randomBytes(3).toString('hex')}`
}
