// 车型配置
export interface Model {
    id: string
    slug: string
    name: string
    name_en?: string
    model_3d_url: string // 统一后的字段名
    wheel_url?: string   // 关联的轮毂 GLB 路径
    is_active: boolean
    sort_order?: number
    created_at: string
}

// 统一的贴图数据接口
export interface Wrap {
    id: string
    slug: string | null
    name: string
    name_en?: string
    description?: string
    description_en?: string
    prompt?: string       // AI 生成使用的提示词
    category: string      // 'official' | 'ai_generated' | 'diy'

    // 核心资源字段
    texture_url: string   // 纹理大图路径
    preview_url: string   // 3D/2D 预览图路径

    model_slug?: string    // 适配车型
    model_name?: string    // [NEW] 车型显示名称
    model_name_en?: string // [NEW] 车型英文显示名称
    model_3d_url?: string  // 关联车型的 GLB 路径

    user_id?: string       // 所属用户ID (Tesla Studio ID 为全零)
    author_name?: string   // 从关联表计算出的名称
    author_avatar_url?: string // 从关联表计算出的头像

    download_count: number
    is_public: boolean
    is_active: boolean
    created_at: string
    updated_at?: string
    reference_images?: string[] // AI 生成使用的参考图 URL 列表

    // 冗余字段（仅作类型兼容，后续可逐步移除使用点）
    image_url?: string
    wrap_image_url?: string
    preview_image_url?: string
}

// 下载记录
export interface UserDownload {
    id: string
    user_id: string
    wrap_id: string
    downloaded_at: string
}
