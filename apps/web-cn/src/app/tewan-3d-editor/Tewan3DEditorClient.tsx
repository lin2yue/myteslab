'use client'

import dynamic from 'next/dynamic'
import type { ModelConfig } from '@/config/models'

const Tewan3DEditorApp = dynamic(
  () => import('@/features/tewan-3d-editor/components/Tewan3DEditorApp').then((mod) => mod.Tewan3DEditorApp),
  { ssr: false },
)

export function Tewan3DEditorClient({ models }: { models: ModelConfig[] }) {
  return <Tewan3DEditorApp models={models} />
}
