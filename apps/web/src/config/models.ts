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
    sort_order: number
    is_active: boolean
    thumb_url?: string
    uv_note?: string
}

/**
 * Default Tesla model configurations
 * These values match the production database and serve as a fallback
 */
export const DEFAULT_MODELS: ModelConfig[] = [
    {
        slug: 'cybertruck',
        name: 'Cybertruck',
        model_3d_url: 'https://cdn.tewan.club/models/wraps/cybertruck/model_v1.glb',
        sort_order: 1,
        is_active: true
    },
    {
        slug: 'model-3',
        name: 'Model 3 (经典款)',
        name_en: 'Model 3 (Classic)',
        model_3d_url: 'https://cdn.tewan.club/models/wraps/model-3/model_v1.glb',
        sort_order: 2,
        is_active: true
    },
    {
        slug: 'model-3-2024-plus',
        name: 'Model 3 (焕新版)',
        name_en: 'Model 3 (2024+)',
        model_3d_url: 'https://cdn.tewan.club/models/wraps/model-3-2024-plus/model_v2.glb',
        sort_order: 3,
        is_active: true
    },
    {
        slug: 'model-y-2025-plus',
        name: 'Model Y (2025+)',
        model_3d_url: 'https://cdn.tewan.club/models/wraps/model-y-2025-plus/model_v5.glb',
        sort_order: 4,
        is_active: true
    },
    {
        slug: 'model-y-pre-2025',
        name: 'Model Y (经典款)',
        name_en: 'Model Y (Classic)',
        model_3d_url: 'https://cdn.tewan.club/models/wraps/model-y-pre-2025/model_v2.glb',
        sort_order: 5,
        is_active: true
    }
]

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
