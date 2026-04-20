import { Tewan3DEditorApp } from '@/features/tewan-3d-editor/components/Tewan3DEditorApp'
import { getModels } from '@/lib/api'
import type { ModelConfig } from '@/config/models'

export const dynamic = 'force-dynamic'

export default async function Tewan3DEditorPage() {
  // Fetch from DB (same as AI design page); falls back to DEFAULT_MODELS on failure
  const dbModels = await getModels()

  // Map DB rows to the ModelConfig shape used by the editor
  // The DB doesn't carry uv_mask_url / uv_texture_rotation, so we merge from DEFAULT_MODELS
  const { DEFAULT_MODELS } = await import('@/config/models')

  const models: ModelConfig[] = dbModels.map((m: any) => {
    const defaults = DEFAULT_MODELS.find((d) => d.slug === m.slug)
    return {
      slug: m.slug,
      name: m.name,
      name_en: m.name_en,
      model_3d_url: m.model_3d_url,
      wheel_url: m.wheel_url,
      sort_order: m.sort_order ?? 99,
      is_active: m.is_active ?? true,
      thumb_url: m.thumb_url,
      uv_mask_url: defaults?.uv_mask_url,
      uv_mask_native_width: defaults?.uv_mask_native_width,
      uv_mask_native_height: defaults?.uv_mask_native_height,
      uv_texture_rotation: defaults?.uv_texture_rotation,
    } satisfies ModelConfig
  })

  return (
    <main className="h-screen w-screen overflow-hidden bg-gray-950">
      <Tewan3DEditorApp models={models} />
    </main>
  )
}
