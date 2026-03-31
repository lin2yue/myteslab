'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, X, GripHorizontal, ChevronDown } from 'lucide-react'

type Position = { x: number; y: number }
type Size = { width: number; height: number }

type DraggablePanel3DProps = {
  children: React.ReactNode
  defaultPosition?: Position
  defaultSize?: Size
  minSize?: Size
  onClose?: () => void
  /** Show fullscreen expand button */
  allowFullscreen?: boolean
  title?: string
}

function getDefaultX(w: number) {
  if (typeof window === 'undefined') return 600
  return Math.max(300, window.innerWidth - w - 20)
}

export function DraggablePanel3D({
  children,
  defaultSize = { width: 480, height: 400 },
  minSize = { width: 300, height: 240 },
  onClose,
  allowFullscreen = true,
  title = '3D 预览',
  defaultPosition,
}: DraggablePanel3DProps) {
  const resolvedDefaultPosition = defaultPosition ?? { x: getDefaultX(defaultSize.width), y: 80 }
  const panelRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const resizeState = useRef<{ resizing: boolean; startX: number; startY: number; originW: number; originH: number } | null>(null)

  const [pos, setPos] = useState<Position>(resolvedDefaultPosition)
  const [size, setSize] = useState<Size>(defaultSize)
  const [minimized, setMinimized] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const clampPos = useCallback((x: number, y: number, w: number, h: number): Position => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    return {
      x: Math.max(0, Math.min(x, vw - w)),
      y: Math.max(0, Math.min(y, vh - 40)),
    }
  }, [])

  /* ——— Drag ——— */
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (fullscreen || minimized) return
    e.preventDefault()
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y }
  }, [fullscreen, minimized, pos])

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = dragState.current
      if (!d?.dragging) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      setPos(clampPos(d.originX + dx, d.originY + dy, size.width, size.height))
    }
    const up = () => {
      if (dragState.current) dragState.current.dragging = false
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [clampPos, size])

  /* ——— Resize ——— */
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    if (fullscreen || minimized) return
    e.preventDefault()
    e.stopPropagation()
    resizeState.current = { resizing: true, startX: e.clientX, startY: e.clientY, originW: size.width, originH: size.height }
  }, [fullscreen, minimized, size])

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const r = resizeState.current
      if (!r?.resizing) return
      const w = Math.max(minSize.width, r.originW + (e.clientX - r.startX))
      const h = Math.max(minSize.height, r.originH + (e.clientY - r.startY))
      setSize({ width: w, height: h })
    }
    const up = () => {
      if (resizeState.current) resizeState.current.resizing = false
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [minSize])

  /* ——— Responsive default position ——— */
  useEffect(() => {
    const updatePos = () => {
      setPos((p) => clampPos(p.x, p.y, size.width, size.height))
    }
    window.addEventListener('resize', updatePos)
    return () => window.removeEventListener('resize', updatePos)
  }, [clampPos, size])

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[300] flex flex-col bg-neutral-900">
        <div className="flex h-10 shrink-0 items-center justify-between bg-neutral-800 px-4">
          <span className="text-xs font-semibold text-white">{title}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
              title="退出全屏"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-[200] overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/95 shadow-[0_8px_40px_rgba(0,0,0,0.18)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/95"
      style={{
        left: pos.x,
        top: pos.y,
        width: minimized ? 'auto' : size.width,
        height: minimized ? 'auto' : size.height,
        minWidth: minimized ? 200 : minSize.width,
        transition: 'height 0.15s ease',
      }}
    >
      {/* Header / Drag Handle */}
      <div
        className="flex h-9 shrink-0 cursor-grab items-center justify-between bg-neutral-100/90 px-3 active:cursor-grabbing dark:bg-neutral-800/90 select-none"
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-1.5">
          <GripHorizontal className="h-3.5 w-3.5 text-neutral-400" />
          <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setMinimized((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-200/80 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white"
            title={minimized ? '展开' : '最小化'}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${minimized ? 'rotate-180' : ''}`} />
          </button>
          {allowFullscreen && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setFullscreen(true)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-200/80 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white"
              title="全屏"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-500/20 dark:hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!minimized && (
        <div className="relative min-h-0 flex-1" style={{ height: size.height - 36 }}>
          {children}
          {/* Resize Handle */}
          <div
            className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize"
            onMouseDown={onResizeStart}
          >
            <svg className="h-full w-full text-neutral-300 dark:text-neutral-600" viewBox="0 0 12 12" fill="currentColor">
              <path d="M11 1L1 11M8 1L1 8M11 4L4 11" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
