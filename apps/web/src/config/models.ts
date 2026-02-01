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
export const DEFAULT_MODELS: ModelConfig[] = [
    {
        slug: 'cybertruck',
        name: 'Cybertruck',
        name_en: 'Cybertruck',
        model_3d_url: '/models/cybertruck/body.glb',
        wheel_url: '/models/wheels/cybertruck_wheels.glb',
        sort_order: 1,
        is_active: true
    },
    {
        slug: 'model-3', // Canonical slug for DB/API
        name: 'Model 3 (Classic)',
        name_en: 'Model 3 (Classic)',
        model_3d_url: '/models/model3/body.glb',
        wheel_url: '/models/wheels/stiletto.glb',
        sort_order: 2,
        is_active: true
    },
    {
        slug: 'model3', // Alias for backward compatibility
        name: 'Model 3 (Classic)',
        name_en: 'Model 3 (Classic)',
        model_3d_url: '/models/model3/body.glb',
        wheel_url: '/models/wheels/stiletto.glb',
        sort_order: 2,
        is_active: false // Hide from dropdown to prevent duplication
    },
    {
        slug: 'model-3-2024-plus',
        name: 'Model 3 Highland',
        name_en: 'Model 3 Highland',
        model_3d_url: '/models/model3-2024-base/body.glb',
        wheel_url: '/models/wheels/induction.glb',
        sort_order: 3,
        is_active: true
    },
    {
        slug: 'model-y-pre-2025',
        name: 'Model Y (Classic)',
        name_en: 'Model Y (Classic)',
        model_3d_url: '/models/modely/body.glb',
        wheel_url: '/models/wheels/induction.glb',
        sort_order: 4,
        is_active: true
    },
    {
        slug: 'modely', // Alias for backward compatibility
        name: 'Model Y (Classic)',
        name_en: 'Model Y (Classic)',
        model_3d_url: '/models/modely/body.glb',
        wheel_url: '/models/wheels/induction.glb',
        sort_order: 4,
        is_active: false // Hide from dropdown
    },
    {
        slug: 'model-y-2025-plus',
        name: 'Model Y Juniper',
        name_en: 'Model Y Juniper',
        model_3d_url: '/models/modely-2025-base/body.glb',
        wheel_url: '/models/wheels/induction.glb',
        sort_order: 5,
        is_active: true
    },
    {
        slug: 'modely-l',
        name: 'Model Y L',
        name_en: 'Model Y L',
        model_3d_url: '/models/modely-l/body.glb',
        wheel_url: '/models/wheels/modely-l_wheels.glb',
        sort_order: 6,
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
