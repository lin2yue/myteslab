/**
 * Tesla Model Configuration
 * 
 * This file serves as the source of truth for Tesla model configurations.
 * It provides a fallback when database queries fail and ensures the application
 * can always display available models.
 */

export interface ModelConfig {
    slug: string
    name: string
    name_en?: string
    model_3d_url: string
    wheel_url?: string
    sort_order: number
    is_active: boolean
    thumb_url?: string
    uv_note?: string
}

/**
 * Default Tesla model configurations
 * These values match the production database and serve as a fallback
 */
export const DEFAULT_MODELS: ModelConfig[] = []

/**
 * Get model configuration by slug
 */
export function getModelBySlug(slug: string): ModelConfig | undefined {
    return DEFAULT_MODELS.find(m => m.slug === slug)
}

/**
 * Get all active models
 */
export function getActiveModels(): ModelConfig[] {
    return DEFAULT_MODELS.filter(m => m.is_active)
}

/**
 * Validate model configuration
 */
export function validateModelConfig(model: any): model is ModelConfig {
    return (
        typeof model === 'object' &&
        typeof model.slug === 'string' &&
        typeof model.name === 'string' &&
        typeof model.model_3d_url === 'string' &&
        typeof model.sort_order === 'number' &&
        typeof model.is_active === 'boolean'
    )
}
