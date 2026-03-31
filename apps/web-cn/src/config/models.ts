/**
 * Tesla Model Configuration
 *
 * Source of truth for Tesla model configurations.
 * Kept in sync with the `wrap_models` database table (production).
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
    /** UV 遮罩模板图片 URL */
    uv_mask_url?: string
    /** UV 遮罩图片原始宽度（像素），默认 1024 */
    uv_mask_native_width?: number
    /** UV 遮罩图片原始高度（像素），默认 1024 */
    uv_mask_native_height?: number
    /**
     * 将画布纹理旋转此角度后提交给 3D 模型（与 OSS 处理一致）。
     * - cybertruck: 90（顺时针 90°）
     * - 其他车型: 180
     */
    uv_texture_rotation?: 0 | 90 | 180
}

// CDN base
const CDN = 'https://cdn.tewan.club'

/**
 * Default models — mirrors the `wrap_models` table.
 * These serve as a fallback when database queries fail.
 */
export const DEFAULT_MODELS: ModelConfig[] = [
    {
        slug: 'cybertruck',
        name: 'Cybertruck',
        name_en: 'Cybertruck',
        model_3d_url: `${CDN}/models/cybertruck/body.glb`,
        wheel_url: `${CDN}/models/wheels/cybertruck_wheels.glb`,
        sort_order: 1,
        is_active: true,
        uv_mask_url: `${CDN}/masks/cybertruck_mask.png`,
        uv_mask_native_width: 768,
        uv_mask_native_height: 1024,
        uv_texture_rotation: 90,
    },
    {
        slug: 'model-3',
        name: 'Model 3',
        name_en: 'Model 3',
        model_3d_url: `${CDN}/models/model3/body.glb`,
        wheel_url: `${CDN}/models/wheels/stiletto.glb`,
        sort_order: 2,
        is_active: true,
        uv_mask_url: `${CDN}/masks/model-3_mask.png`,
        uv_texture_rotation: 180,
    },
    {
        slug: 'model-3-2024',
        name: 'Model 3 焕新版',
        name_en: 'Model 3 Highland',
        model_3d_url: `${CDN}/models/model3-2024-base/body.glb`,
        wheel_url: `${CDN}/models/wheels/induction.glb`,
        sort_order: 3,
        is_active: true,
        uv_mask_url: `${CDN}/masks/model-3-2024_mask.png`,
        uv_texture_rotation: 180,
    },
    {
        slug: 'model-y',
        name: 'Model Y',
        name_en: 'Model Y',
        model_3d_url: `${CDN}/models/modely/body.glb`,
        wheel_url: `${CDN}/models/wheels/induction.glb`,
        sort_order: 4,
        is_active: true,
        uv_mask_url: `${CDN}/masks/model-y_mask.png`,
        uv_texture_rotation: 180,
    },
    {
        slug: 'model-y-2025-standard',
        name: 'Model Y 基础版',
        name_en: 'Model Y Juniper Standard',
        model_3d_url: `${CDN}/models/modely-2025-base/body.glb`,
        wheel_url: `${CDN}/models/wheels/induction.glb`,
        sort_order: 5,
        is_active: true,
        uv_mask_url: `${CDN}/masks/model-y-2025-standard_mask.png`,
        uv_texture_rotation: 180,
    },
    {
        slug: 'modely-l',
        name: 'Model Y L',
        name_en: 'Model Y Long Range',
        model_3d_url: `${CDN}/models/modely-l/body.glb`,
        wheel_url: `${CDN}/models/wheels/modely-l_wheels.glb`,
        sort_order: 6,
        is_active: true,
        uv_mask_url: `${CDN}/masks/modely-l_mask.png`,
        uv_texture_rotation: 180,
    },
    {
        slug: 'model-3-2024-performance',
        name: 'Model 3 焕新版 (Performance)',
        name_en: 'Model 3 Highland Performance',
        model_3d_url: `${CDN}/models/model3-2024-performance/body.glb`,
        wheel_url: `${CDN}/models/wheels/induction.glb`,
        sort_order: 7,
        is_active: true,
        uv_mask_url: `${CDN}/masks/model-3-2024-performance_mask.png`,
        uv_texture_rotation: 180,
    },
    {
        slug: 'model-y-2025-performance',
        name: 'Model Y 焕新版 (Performance)',
        name_en: 'Model Y Juniper Performance',
        model_3d_url: `${CDN}/models/modely-2025-performance/body.glb`,
        wheel_url: `${CDN}/models/wheels/induction.glb`,
        sort_order: 8,
        is_active: true,
        uv_mask_url: `${CDN}/masks/model-y-2025-performance_mask.png`,
        uv_texture_rotation: 180,
    },
    {
        slug: 'model-y-2025-premium',
        name: 'Model Y 焕新版',
        name_en: 'Model Y Juniper Premium',
        model_3d_url: `${CDN}/models/modely-2025-premium/body.glb`,
        wheel_url: `${CDN}/models/wheels/induction.glb`,
        sort_order: 9,
        is_active: true,
        uv_mask_url: `${CDN}/masks/model-y-2025-premium_mask.png`,
        uv_texture_rotation: 180,
    },
]

export function getModelBySlug(slug: string): ModelConfig | undefined {
    return DEFAULT_MODELS.find(m => m.slug === slug)
}

export function getActiveModels(): ModelConfig[] {
    return DEFAULT_MODELS.filter(m => m.is_active)
}

export function validateModelConfig(model: unknown): model is ModelConfig {
    return (
        typeof model === 'object' && model !== null &&
        typeof (model as ModelConfig).slug === 'string' &&
        typeof (model as ModelConfig).name === 'string' &&
        typeof (model as ModelConfig).model_3d_url === 'string' &&
        typeof (model as ModelConfig).sort_order === 'number' &&
        typeof (model as ModelConfig).is_active === 'boolean'
    )
}
