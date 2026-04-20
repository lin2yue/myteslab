'use client'

import { useMemo } from 'react'
import { ModelViewer } from '@/components/ModelViewer'
import { getMaterialRuleByModel } from '../config/material-map'
import { resolveModelAssetUrl } from '@/lib/editor/resolve-model-asset-url'

type CarPreview3DProps = {
  modelUrl: string
  wheelUrl?: string
  modelSlug: string
  textureDataUrl: string | null
  lightingMode?: 'day' | 'garage'
  /** 与 AI 设计页一致 */
  autoRotate?: boolean
}

export function CarPreview3D({
  modelUrl,
  wheelUrl,
  modelSlug,
  textureDataUrl,
  lightingMode = 'day',
  autoRotate = true,
}: CarPreview3DProps) {
  const materialFilter = useMemo(() => {
    const rule = getMaterialRuleByModel(modelSlug)
    return (materialName: string, meshName: string): boolean => {
      const normalizedMaterial = materialName.toLowerCase().trim()
      const target = `${meshName} ${materialName}`.toLowerCase()
      if (rule.excludeKeywords.some((k) => target.includes(k))) return false
      if (rule.includeExact.includes(normalizedMaterial)) return true
      if (rule.includeKeywords.some((k) => target.includes(k))) return true
      if (normalizedMaterial === '') return true
      return false
    }
  }, [modelSlug])

  /** 与 AIGeneratorMain 中 ModelViewer 一致：浅色 #FFFFFF，深色 #1F1F1F */
  const backgroundColor = lightingMode === 'garage' ? '#1F1F1F' : '#FFFFFF'

  const resolvedModelUrl = useMemo(() => resolveModelAssetUrl(modelUrl), [modelUrl])
  const resolvedWheelUrl = useMemo(
    () => (wheelUrl ? resolveModelAssetUrl(wheelUrl) : undefined),
    [wheelUrl]
  )

  return (
    <ModelViewer
      modelUrl={resolvedModelUrl}
      wheelUrl={resolvedWheelUrl}
      modelSlug={modelSlug}
      textureUrl={textureDataUrl ?? undefined}
      materialFilter={materialFilter}
      backgroundColor={backgroundColor}
      autoRotate={autoRotate}
      environment="neutral"
      showTips={false}
      className="h-full w-full"
    />
  )
}
