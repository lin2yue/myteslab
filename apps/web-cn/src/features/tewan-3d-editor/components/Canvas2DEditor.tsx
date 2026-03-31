'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { fabric } from 'fabric'
import { useEditorStore } from '../store/useEditorStore'

export const WIDTH = 1024
export const HEIGHT = 1024
const BASE_LAYER_NAME = '__base_fill_layer__'

export type EditorProjectData = {
  version: 1
  canvas: Record<string, unknown>
  toolState: {
    tool: string
    shapeType: 'rect' | 'circle' | 'line'
    color: string
    brushSize: number
    fontSize: number
    fontFamily: string
  }
}

export type Canvas2DEditorRef = {
  exportProject: () => EditorProjectData | null
  importProject: (project: EditorProjectData) => Promise<void>
  addImageFromDataUrl: (dataUrl: string) => void
  fillAll: (color: string) => void
  addShape: (shapeType: 'rect' | 'circle' | 'line', color: string) => void
  addText: (text: string, fontSize: number, fontFamily: string, color: string) => void
  addSticker: (emoji: string) => void
  deleteSelected: () => void
  clearCanvas: () => void
  bringToFront: () => void
  sendToBack: () => void
  getCanvas: () => fabric.Canvas | null
}

export type Canvas2DEditorProps = {
  layout?: 'stacked' | 'studio' | 'canvas-only'
  onSelectionChange?: (hasSelection: boolean) => void
  /** 半透明 UV 遮罩图片 URL */
  uvMaskUrl?: string
  /** UV 遮罩图片原始宽度（像素），与 WIDTH(1024) 不同时按比例居中显示 */
  uvMaskNativeWidth?: number
  /** UV 遮罩图片原始高度（像素），与 HEIGHT(1024) 不同时按比例居中显示 */
  uvMaskNativeHeight?: number
  /** UV 遮罩不透明度 0–1，默认 0.35 */
  uvMaskOpacity?: number
  /**
   * 旋转遮罩图片（CSS transform rotate），使其以"贴膜效果"方向展示给用户。
   * 与 OSS 纹理旋转角度相同：cybertruck=90，其他=180，不需要旋转=0。
   */
  uvMaskRotation?: 0 | 90 | 180
}

export const Canvas2DEditor = forwardRef<Canvas2DEditorRef, Canvas2DEditorProps>(function Canvas2DEditor(
  {
    layout = 'stacked',
    onSelectionChange,
    uvMaskUrl,
    uvMaskNativeWidth = WIDTH,
    uvMaskNativeHeight = HEIGHT,
    uvMaskOpacity = 0.35,
    uvMaskRotation = 0,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const syncRafRef = useRef<number | null>(null)
  const drawSyncThrottleRef = useRef<number>(0)

  const {
    tool, shapeType, color, brushSize, fontSize, fontFamily,
    setTool, setShapeType, setColor, setBrushSize, setFontSize, setFontFamily,
    setTextureDataUrl,
  } = useEditorStore()

  /* ─── Texture sync ───────────────────────────────────────────────────── */
  const syncTexture = useCallback(() => {
    const c = fabricRef.current
    if (!c) return
    if (syncRafRef.current) cancelAnimationFrame(syncRafRef.current)
    syncRafRef.current = requestAnimationFrame(() => {
      syncRafRef.current = null
      const c2 = fabricRef.current
      if (!c2) return
      setTextureDataUrl(c2.toDataURL({ format: 'png', multiplier: 1 }))
    })
  }, [setTextureDataUrl])

  /* ─── Base fill layer ───────────────────────────────────────────────── */
  const ensureBaseFillLayer = useCallback(() => {
    const c = fabricRef.current
    if (!c) return null
    let layer = c.getObjects().find(
      (o) => (o as fabric.Object & { name?: string }).name === BASE_LAYER_NAME
    )
    if (!layer) {
      layer = new fabric.Rect({
        left: 0, top: 0, width: WIDTH, height: HEIGHT,
        fill: '#111827', selectable: false, evented: false, hoverCursor: 'default',
      })
      ;(layer as fabric.Object & { name?: string }).name = BASE_LAYER_NAME
      c.add(layer)
      c.sendToBack(layer)
    }
    return layer
  }, [])

  /* ─── Imperative canvas actions ─────────────────────────────────────── */
  const fillAll = useCallback((fillColor: string) => {
    const c = fabricRef.current; if (!c) return
    const layer = ensureBaseFillLayer(); if (!layer) return
    layer.set('fill', fillColor)
    c.sendToBack(layer); c.requestRenderAll(); syncTexture()
  }, [ensureBaseFillLayer, syncTexture])

  const addShape = useCallback((sType: 'rect' | 'circle' | 'line', fillColor: string) => {
    const c = fabricRef.current; if (!c) return
    if (sType === 'rect') {
      c.add(new fabric.Rect({ left: WIDTH / 2 - 120, top: HEIGHT / 2 - 80, width: 240, height: 160, fill: fillColor, opacity: 0.92, rx: 12, ry: 12 }))
    } else if (sType === 'circle') {
      c.add(new fabric.Circle({ left: WIDTH / 2 - 100, top: HEIGHT / 2 - 100, radius: 100, fill: fillColor, opacity: 0.92 }))
    } else {
      c.add(new fabric.Line([WIDTH / 2 - 150, HEIGHT / 2, WIDTH / 2 + 150, HEIGHT / 2], { stroke: fillColor, strokeWidth: 8 }))
    }
    c.requestRenderAll()
  }, [])

  const addText = useCallback((text: string, fSize: number, fFamily: string, fillColor: string) => {
    const c = fabricRef.current; if (!c) return
    const t = new fabric.IText(text, { left: WIDTH / 2 - 120, top: HEIGHT / 2 - 30, fontSize: fSize, fill: fillColor, fontWeight: '700', fontFamily: fFamily })
    c.add(t); c.setActiveObject(t); c.requestRenderAll()
  }, [])

  const addSticker = useCallback((emoji: string) => {
    const c = fabricRef.current; if (!c) return
    const t = new fabric.IText(emoji, {
      left: WIDTH / 2 - 50 + Math.random() * 60 - 30,
      top: HEIGHT / 2 - 50 + Math.random() * 60 - 30,
      fontSize: 120, selectable: true,
    })
    c.add(t); c.setActiveObject(t); c.requestRenderAll()
  }, [])

  const addImageFromDataUrl = useCallback((dataUrl: string) => {
    const c = fabricRef.current; if (!c) return
    fabric.Image.fromURL(dataUrl, (img) => {
      const scaleX = (WIDTH * 0.8) / (img.width || WIDTH)
      const scaleY = (HEIGHT * 0.8) / (img.height || HEIGHT)
      const scale = Math.min(scaleX, scaleY, 1)
      img.set({
        left: (WIDTH - (img.width || 0) * scale) / 2,
        top: (HEIGHT - (img.height || 0) * scale) / 2,
        scaleX: scale, scaleY: scale, selectable: true,
      })
      c.add(img); c.setActiveObject(img); c.requestRenderAll()
      syncTexture()
    }, { crossOrigin: 'anonymous' })
  }, [syncTexture])

  const deleteSelected = useCallback(() => {
    const c = fabricRef.current; if (!c) return
    c.getActiveObjects().forEach((o) => {
      if ((o as fabric.Object & { name?: string }).name !== BASE_LAYER_NAME) c.remove(o)
    })
    c.discardActiveObject(); c.requestRenderAll(); syncTexture()
  }, [syncTexture])

  const bringToFront = useCallback(() => {
    const c = fabricRef.current; if (!c) return
    const a = c.getActiveObject(); if (a) { c.bringToFront(a); c.requestRenderAll(); syncTexture() }
  }, [syncTexture])

  const sendToBack = useCallback(() => {
    const c = fabricRef.current; if (!c) return
    const a = c.getActiveObject()
    if (a) { c.sendBackwards(a, true); ensureBaseFillLayer(); c.requestRenderAll(); syncTexture() }
  }, [ensureBaseFillLayer, syncTexture])

  const clearCanvas = useCallback(() => {
    const c = fabricRef.current; if (!c) return
    c.getObjects()
      .filter((o) => (o as fabric.Object & { name?: string }).name !== BASE_LAYER_NAME)
      .forEach((o) => c.remove(o))
    c.requestRenderAll(); syncTexture()
  }, [syncTexture])

  const getCanvas = useCallback(() => fabricRef.current, [])

  /* ─── Expose ref ────────────────────────────────────────────────────── */
  useImperativeHandle(ref, () => ({
    exportProject: () => {
      const c = fabricRef.current; if (!c) return null
      return { version: 1, canvas: c.toDatalessJSON(['name']), toolState: { tool, shapeType, color, brushSize, fontSize, fontFamily } }
    },
    importProject: async (project) => {
      const c = fabricRef.current; if (!c) return
      await new Promise<void>((resolve) => {
        c.loadFromJSON(project.canvas as Record<string, unknown>, () => {
          ensureBaseFillLayer(); c.requestRenderAll(); resolve()
        })
      })
      setShapeType(project.toolState.shapeType); setColor(project.toolState.color)
      setBrushSize(project.toolState.brushSize)
      if (project.toolState.fontSize) setFontSize(project.toolState.fontSize)
      if (project.toolState.fontFamily) setFontFamily(project.toolState.fontFamily)
      syncTexture()
    },
    addImageFromDataUrl, fillAll, addShape, addText, addSticker,
    deleteSelected, clearCanvas, bringToFront, sendToBack, getCanvas,
  }), [
    brushSize, color, shapeType, tool, fontSize, fontFamily,
    ensureBaseFillLayer, setBrushSize, setColor, setShapeType,
    setFontSize, setFontFamily, syncTexture,
    addImageFromDataUrl, fillAll, addShape, addText, addSticker,
    deleteSelected, clearCanvas, bringToFront, sendToBack, getCanvas,
  ])

  /* ─── Init canvas (once) ────────────────────────────────────────────── */
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return
    const c = new fabric.Canvas(canvasRef.current, {
      width: WIDTH, height: HEIGHT,
      backgroundColor: '#0b1220',
      preserveObjectStacking: true,
      enableRetinaScaling: false,
    })
    fabricRef.current = c
    ensureBaseFillLayer()

    c.freeDrawingBrush = new fabric.PencilBrush(c)
    c.freeDrawingBrush.width = 12
    c.freeDrawingBrush.color = '#ff2d55'
    c.isDrawingMode = false   // start in select mode

    c.on('selection:created', () => { onSelectionChange?.(true) })
    c.on('selection:updated', () => { onSelectionChange?.(true) })
    c.on('selection:cleared', () => { onSelectionChange?.(false) })

    // Sync on committed events only
    c.on('path:created', () => { c.requestRenderAll(); syncTexture() })
    c.on('object:added', syncTexture)
    c.on('object:modified', syncTexture)
    c.on('object:removed', syncTexture)

    // Real-time 3D update while drawing — throttled to ~12fps
    c.on('mouse:move', () => {
      if (!c.isDrawingMode) return
      const now = Date.now()
      if (now - drawSyncThrottleRef.current > 80) {
        drawSyncThrottleRef.current = now
        syncTexture()
      }
    })
    c.on('mouse:up', () => { if (c.isDrawingMode) syncTexture() })

    syncTexture()

    return () => {
      if (syncRafRef.current) cancelAnimationFrame(syncRafRef.current)
      c.dispose()
      fabricRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ─── Sync tool / brush ─────────────────────────────────────────────── */
  useEffect(() => {
    const c = fabricRef.current; if (!c || !c.freeDrawingBrush) return
    const isPaint = tool === 'paint'
    const isErase = tool === 'erase'
    const isSelect = tool === 'select'

    c.isDrawingMode = isPaint || isErase
    c.selection = isSelect
    c.freeDrawingBrush.width = brushSize
    c.freeDrawingBrush.color = isErase ? '#0b1220' : color   // erase by painting bg color

    c.getObjects().forEach((o) => {
      const name = (o as fabric.Object & { name?: string }).name
      if (name !== BASE_LAYER_NAME) {
        o.selectable = isSelect
        o.evented = isSelect
      }
    })
    c.requestRenderAll()
  }, [tool, brushSize, color])

  /* ─── Sync font for active IText ────────────────────────────────────── */
  useEffect(() => {
    const c = fabricRef.current; if (!c) return
    const a = c.getActiveObject()
    if (a instanceof fabric.IText) { a.set({ fontSize, fontFamily }); c.requestRenderAll(); syncTexture() }
  }, [fontSize, fontFamily, syncTexture])

  /* ─── Canvas element ────────────────────────────────────────────────── */
  const canvasEl = <canvas ref={canvasRef} />

  /* ─── Layouts ───────────────────────────────────────────────────────── */
  const maskProps = { uvMaskUrl, uvMaskNativeWidth, uvMaskNativeHeight, uvMaskOpacity, uvMaskRotation }

  if (layout === 'canvas-only') {
    return (
      <div className="h-full w-full overflow-auto flex items-center justify-center bg-neutral-900/50 p-4">
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#090f1a] shadow-md"
          style={{ width: 'min(90vw, 1024px)', aspectRatio: '1 / 1' }}
        >
          <ScaledCanvas {...maskProps}>{canvasEl}</ScaledCanvas>
        </div>
      </div>
    )
  }

  if (layout === 'studio') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-neutral-300 bg-[#090f1a] shadow-md dark:border-white/15 h-full">
        <ScaledCanvas {...maskProps}>{canvasEl}</ScaledCanvas>
      </div>
    )
  }

  // stacked (legacy)
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#090f1a]">
      <ScaledCanvas {...maskProps}>{canvasEl}</ScaledCanvas>
    </div>
  )
})

/* ─── ScaledCanvas ─────────────────────────────────────────────────────── */
// Scales the 1024×1024 Fabric canvas down to fit its container using CSS transform.
// The UV mask overlay is rotated (via CSS transform) so the car appears right-side up,
// matching the orientation the user will see in the 3D preview.
//
// Rotation note (mirrors the OSS post-processing in /api/wrap/generate):
//   cybertruck  → 90° CW  (mask is portrait 768×1024; displayed as landscape)
//   Model 3/Y   → 180°    (mask is 1024×1024; displayed upside-down → rotated upright)
function ScaledCanvas({
  children,
  uvMaskUrl,
  uvMaskNativeWidth = WIDTH,
  uvMaskNativeHeight = HEIGHT,
  uvMaskOpacity = 0.35,
  uvMaskRotation = 0,
}: {
  children: React.ReactNode
  uvMaskUrl?: string
  uvMaskNativeWidth?: number
  uvMaskNativeHeight?: number
  uvMaskOpacity?: number
  uvMaskRotation?: 0 | 90 | 180
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const outer = wrapperRef.current?.parentElement
    if (!outer) return
    const measure = () => {
      const { width, height } = outer.getBoundingClientRect()
      if (width > 0 && height > 0) setScale(Math.min(width / WIDTH, height / HEIGHT, 1))
    }
    const obs = new ResizeObserver(measure)
    obs.observe(outer)
    measure()
    return () => obs.disconnect()
  }, [])

  // The mask element itself is always uvMaskNativeWidth × uvMaskNativeHeight (in canvas pixels).
  // We position it centered in the 1024×1024 canvas space, then apply CSS rotation.
  // For 90° rotation the element visually swaps W↔H, so centering still works because
  // CSS transform-origin defaults to the element's own center.
  const maskElW = uvMaskNativeWidth * scale
  const maskElH = uvMaskNativeHeight * scale
  const maskLeft = ((WIDTH - uvMaskNativeWidth) / 2) * scale
  const maskTop = ((HEIGHT - uvMaskNativeHeight) / 2) * scale

  return (
    <div
      ref={wrapperRef}
      style={{ width: WIDTH * scale, height: HEIGHT * scale, position: 'relative', overflow: 'hidden' }}
    >
      {/* Fabric canvas (1024×1024 logical, scaled via CSS transform) */}
      <div style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>

      {/* UV mask: positioned centered, rotated to match display orientation */}
      {uvMaskUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={uvMaskUrl}
          alt="UV 模板"
          draggable={false}
          style={{
            position: 'absolute',
            left: maskLeft,
            top: maskTop,
            width: maskElW,
            height: maskElH,
            opacity: uvMaskOpacity,
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 20,
            mixBlendMode: 'screen',
            transform: uvMaskRotation ? `rotate(${uvMaskRotation}deg)` : undefined,
            transformOrigin: 'center center',
          }}
        />
      )}
    </div>
  )
}
