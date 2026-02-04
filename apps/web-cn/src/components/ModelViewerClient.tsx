'use client'

import dynamic from 'next/dynamic'

export const ModelViewerClient = dynamic(
  () => import('./ModelViewer').then((m) => m.ModelViewer),
  {
    ssr: false,
  }
)
