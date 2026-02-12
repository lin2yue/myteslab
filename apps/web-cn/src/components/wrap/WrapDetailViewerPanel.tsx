'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from '@/lib/i18n'
import { Camera, Moon, Pause, RotateCw, Sun } from 'lucide-react'
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer'
import Card from '@/components/ui/Card'
import { getEffectiveTheme, THEME_CHANGE_EVENT } from '@/utils/theme'

interface WrapDetailViewerPanelProps {
  modelUrl: string
  wheelUrl?: string
  textureUrl?: string
  modelSlug?: string
  snapshotPrefix?: string
}

export default function WrapDetailViewerPanel({
  modelUrl,
  wheelUrl,
  textureUrl,
  modelSlug,
  snapshotPrefix = 'wrap'
}: WrapDetailViewerPanelProps) {
  const tGen = useTranslations('Generator')
  const themeStorageKey = 'wrap_detail_viewer_theme'
  const [isNight, setIsNight] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem(themeStorageKey)
    if (stored === 'night') return true
    if (stored === 'day') return false
    return getEffectiveTheme() === 'dark'
  })
  const [autoRotate, setAutoRotate] = useState(true)
  const isNightManualRef = useRef(false)
  const viewerRef = useRef<ModelViewerRef>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(themeStorageKey)
    if (stored === 'night' || stored === 'day') {
      isNightManualRef.current = true
    }
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      if (isNightManualRef.current) return
      const detail = (event as CustomEvent).detail as { effective?: string } | undefined
      const effective = detail?.effective || getEffectiveTheme()
      setIsNight(effective === 'dark')
    }
    window.addEventListener(THEME_CHANGE_EVENT, handler as EventListener)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handler as EventListener)
  }, [])

  const takeSnapshot = async () => {
    if (!viewerRef.current) return
    try {
      const dataUrl = await viewerRef.current.takeHighResScreenshot({ zoomOut: false, preserveAspect: true })
      if (!dataUrl) return

      const link = document.createElement('a')
      const modelPart = modelSlug || 'model'
      link.download = `${snapshotPrefix}-${modelPart}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Failed to capture wrap detail snapshot:', error)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative w-full aspect-[4/3] lg:aspect-video bg-black/5 dark:bg-white/10">
        <ModelViewer
          ref={viewerRef}
          modelUrl={modelUrl}
          wheelUrl={wheelUrl}
          textureUrl={textureUrl}
          modelSlug={modelSlug}
          backgroundColor={isNight ? '#1F1F1F' : '#FFFFFF'}
          autoRotate={autoRotate}
          className="w-full h-full"
        />
      </div>

      <div className="flex flex-row items-center px-4 sm:px-6 py-4 border-t border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-950/80 gap-2 overflow-x-auto backdrop-blur">
        <button
          onClick={() => {
            const next = !isNight
            setIsNight(next)
            isNightManualRef.current = true
            if (typeof window !== 'undefined') {
              localStorage.setItem(themeStorageKey, next ? 'night' : 'day')
            }
          }}
          className="btn-secondary h-10 px-4 rounded-lg flex items-center gap-1.5 flex-shrink-0"
        >
          {isNight ? (
            <>
              <Sun className="w-5 h-5 lg:w-4 lg:h-4" />
              <span className="hidden lg:inline">{tGen('day_mode')}</span>
            </>
          ) : (
            <>
              <Moon className="w-5 h-5 lg:w-4 lg:h-4" />
              <span className="hidden lg:inline">{tGen('night_mode')}</span>
            </>
          )}
        </button>

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`btn-secondary h-10 px-4 rounded-lg flex items-center gap-1.5 flex-shrink-0 ${autoRotate ? 'bg-black/10 text-zinc-900 dark:text-white' : ''}`}
        >
          {autoRotate ? (
            <>
              <Pause className="w-5 h-5 lg:w-4 lg:h-4" />
              <span className="hidden lg:inline">{tGen('auto_rotate_on')}</span>
            </>
          ) : (
            <>
              <RotateCw className="w-5 h-5 lg:w-4 lg:h-4" />
              <span className="hidden lg:inline">{tGen('auto_rotate_off')}</span>
            </>
          )}
        </button>

        <div className="hidden lg:block lg:flex-1" />

        <button
          onClick={takeSnapshot}
          className="btn-secondary h-10 px-4 rounded-lg flex items-center gap-1.5 flex-shrink-0"
        >
          <Camera className="w-5 h-5 lg:w-4 lg:h-4" />
          <span className="hidden lg:inline">{tGen('screenshot')}</span>
        </button>
      </div>
    </Card>
  )
}
