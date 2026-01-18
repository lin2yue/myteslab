// 车型配置
export interface Model {
    id: string
    slug: string
    name: string
    name_en?: string
    model_3d_url: string
    is_active: boolean
    sort_order?: number
    created_at: string
}

// 贴图数据
export interface Wrap {
    id: string
    slug: string
    name: string
    name_en?: string
    description?: string
    description_en?: string
    category: string
    image_url: string  // 贴图纹理URL (可能为空)
    wrap_image_url?: string // 实际存储的贴图纹理URL
    preview_image_url: string  // 预览图URL
    model_3d_url?: string  // 3D模型URL
    model_slug?: string    // 车型Slug
    download_count: number
    is_active: boolean
    sort_order?: number
    created_at: string
    updated_at?: string
}

// 车型-贴图关联
export interface ModelWrap {
    model_id: string
    wrap_id: string
}
