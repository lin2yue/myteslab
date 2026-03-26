'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { fabric } from 'fabric'
import { useEditorStore } from '../store/useEditorStore'

const WIDTH = 1024
const HEIGHT = 1024
const BASE_LAYER_NAME = '__base_fill_layer__'
const QUICK_COLORS = ['#ffffff', '#0f172a', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#94a3b8']

const FONT_FAMILIES = ['Inter', 'Arial', 'Georgia', 'Courier New', 'Impact', 'Times New Roman']

const STICKERS = [
  { id: 's1', label: '🔥' },
  { id: 's2', label: '⚡' },
  { id: 's3', label: '🏁' },
  { id: 's4', label: '⭐' },
  { id: 's5', label: '💀' },
  { id: 's6', label: '👑' },
  { id: 's7', label: '💎' },
  { id: 's8', label: '🚀' },
  { id: 's9', label: '🎯' },
  { id: 's10', label: '🦅' },
  { id: 's11', label: '🐉' },
  { id: 's12', label: '🌊' },
  { id: 's13', label: '☠️' },
  { id: 's14', label: '🎪' },
  { id: 's15', label: '🏆' },
  { id: 's16', label: '🎸' },
]

export type EditorProjectData = {
  version: 1
  canvas: Record<string, unknown>
  toolState: {
    tool: 'paint' | 'shape' | 'text' | 'sticker'
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
}

export type Canvas2DEditorProps = {
  /** stacked：工具在上、画布在下（旧版侧栏内）；studio：参考高级编辑器，工具在左、画布居中放大 */
  layout?: 'stacked' | 'studio'
}

export const Canvas2DEditor = forwardRef<Canvas2DEditorRef, Canvas2DEditorProps>(function Canvas2DEditor(
  { layout = 'stacked' },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const rafSyncRef = useRef<number | null>(null)
  const isDrawingLineRef = useRef(false)
  const lineStartRef = useRef<{ x: number; y: number } | null>(null)
  const activeLineRef = useRef<fabric.Line | null>(null)

  const [hasSelection, setHasSelection] = useState(false)
  const [activePanel, setActivePanel] = useState<'tools' | 'stickers'>('tools')

  const {
    tool, shapeType, color, brushSize, fontSize, fontFamily,
    setTool, setShapeType, setColor, setBrushSize, setFontSize, setFontFamily,
    setTextureDataUrl,
  } = useEditorStore()

  const bg = useMemo(() => '#0b1220', [])

  const syncTexture = useCallback(() => {
    const c = fabricCanvasRef.current
    if (!c) return
    setTextureDataUrl(c.toDataURL({ format: 'png', multiplier: 1 }))
  }, [setTextureDataUrl])

  const syncTextureThrottled = useCallback(() => {
    if (rafSyncRef.current) return
    rafSyncRef.current = requestAnimationFrame(() => {
      syncTexture()
      rafSyncRef.current = null
    })
  }, [syncTexture])

  const ensureBaseFillLayer = useCallback(() => {
    const c = fabricCanvasRef.current
    if (!c) return null
    let layer = c.getObjects().find((obj) => (obj as fabric.Object & { name?: string }).name === BASE_LAYER_NAME)
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

  useImperativeHandle(ref, () => ({
    exportProject: () => {
      const c = fabricCanvasRef.current
      if (!c) return null
      return {
        version: 1,
        canvas: c.toDatalessJSON(['name']),
        toolState: { tool, shapeType, color, brushSize, fontSize, fontFamily },
      }
    },
    importProject: async (project) => {
      const c = fabricCanvasRef.current
      if (!c) return
      await new Promise<void>((resolve) => {
        c.loadFromJSON(project.canvas as Record<string, unknown>, () => {
          ensureBaseFillLayer()
          c.renderAll()
          resolve()
        })
      })
      setTool(project.toolState.tool)
      setShapeType(project.toolState.shapeType)
      setColor(project.toolState.color)
      setBrushSize(project.toolState.brushSize)
      if (project.toolState.fontSize) setFontSize(project.toolState.fontSize)
      if (project.toolState.fontFamily) setFontFamily(project.toolState.fontFamily)
      syncTexture()
    },
  }), [brushSize, color, shapeType, tool, fontSize, fontFamily, ensureBaseFillLayer, setBrushSize, setColor, setShapeType, setTool, setFontSize, setFontFamily, syncTexture])

  // Init canvas
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return
    const c = new fabric.Canvas(canvasRef.current, {
      width: WIDTH, height: HEIGHT, backgroundColor: bg, preserveObjectStacking: true,
    })
    fabricCanvasRef.current = c
    ensureBaseFillLayer()
    c.freeDrawingBrush = new fabric.PencilBrush(c)
    c.freeDrawingBrush.width = brushSize
    c.freeDrawingBrush.color = color
    c.isDrawingMode = true

    c.on('selection:created', () => setHasSelection(true))
    c.on('selection:updated', () => setHasSelection(true))
    c.on('selection:cleared', () => setHasSelection(false))

    c.on('object:added', syncTexture)
    c.on('object:modified', syncTexture)
    c.on('object:removed', syncTexture)
    c.on('path:created', syncTexture)
    c.on('mouse:move', () => { if (c.isDrawingMode) syncTextureThrottled() })
    c.on('after:render', syncTextureThrottled)
    syncTexture()

    return () => {
      if (rafSyncRef.current) cancelAnimationFrame(rafSyncRef.current)
      c.dispose()
      fabricCanvasRef.current = null
    }
  }, [bg, brushSize, color, ensureBaseFillLayer, syncTexture, syncTextureThrottled])

  // Sync tool mode
  useEffect(() => {
    const c = fabricCanvasRef.current
    if (!c || !c.freeDrawingBrush) return
    const isPaint = tool === 'paint'
    c.isDrawingMode = isPaint
    c.selection = !isPaint
    c.freeDrawingBrush.width = brushSize
    c.freeDrawingBrush.color = color
    c.getObjects().forEach((obj) => {
      const name = (obj as fabric.Object & { name?: string }).name
      if (name !== BASE_LAYER_NAME) {
        obj.selectable = !isPaint
        obj.evented = !isPaint
      }
    })
    c.renderAll()
  }, [tool, brushSize, color])

  // Sync font size / family for active IText
  useEffect(() => {
    const c = fabricCanvasRef.current
    if (!c) return
    const active = c.getActiveObject()
    if (active instanceof fabric.IText) {
      active.set({ fontSize, fontFamily })
      c.renderAll()
      syncTexture()
    }
  }, [fontSize, fontFamily, syncTexture])

  // ——— Actions ———

  const fillAll = () => {
    const c = fabricCanvasRef.current
    if (!c) return
    const layer = ensureBaseFillLayer()
    if (!layer) return
    layer.set('fill', color)
    c.sendToBack(layer)
    c.renderAll()
    syncTexture()
  }

  const addShape = () => {
    const c = fabricCanvasRef.current
    if (!c) return
    if (shapeType === 'rect') {
      c.add(new fabric.Rect({ left: WIDTH / 2 - 120, top: HEIGHT / 2 - 80, width: 240, height: 160, fill: color, opacity: 0.92, rx: 12, ry: 12 }))
    } else if (shapeType === 'circle') {
      c.add(new fabric.Circle({ left: WIDTH / 2 - 100, top: HEIGHT / 2 - 100, radius: 100, fill: color, opacity: 0.92 }))
    } else if (shapeType === 'line') {
      c.add(new fabric.Line([WIDTH / 2 - 150, HEIGHT / 2, WIDTH / 2 + 150, HEIGHT / 2], { stroke: color, strokeWidth: 8, selectable: true }))
    }
    c.renderAll()
  }

  const addText = () => {
    const c = fabricCanvasRef.current
    if (!c) return
    const t = new fabric.IText('TESLA', { left: WIDTH / 2 - 120, top: HEIGHT / 2 - 30, fontSize, fill: color, fontWeight: '700', fontFamily })
    c.add(t)
    c.setActiveObject(t)
    c.renderAll()
  }

  const addSticker = (emoji: string) => {
    const c = fabricCanvasRef.current
    if (!c) return
    const t = new fabric.IText(emoji, {
      left: WIDTH / 2 - 50 + Math.random() * 60 - 30,
      top: HEIGHT / 2 - 50 + Math.random() * 60 - 30,
      fontSize: 120,
      selectable: true,
    })
    c.add(t)
    c.setActiveObject(t)
    c.renderAll()
  }

  const deleteSelected = () => {
    const c = fabricCanvasRef.current
    if (!c) return
    const active = c.getActiveObjects()
    active.forEach((obj) => {
      const name = (obj as fabric.Object & { name?: string }).name
      if (name !== BASE_LAYER_NAME) c.remove(obj)
    })
    c.discardActiveObject()
    c.renderAll()
    syncTexture()
  }

  const bringToFront = () => {
    const c = fabricCanvasRef.current
    if (!c) return
    const active = c.getActiveObject()
    if (active) { c.bringToFront(active); c.renderAll(); syncTexture() }
  }

  const sendToBack = () => {
    const c = fabricCanvasRef.current
    if (!c) return
    const active = c.getActiveObject()
    if (active) { c.sendBackwards(active, true); ensureBaseFillLayer(); c.renderAll(); syncTexture() }
  }

  const clearCanvas = () => {
    const c = fabricCanvasRef.current
    if (!c) return
    const objects = c.getObjects().filter((obj) => (obj as fabric.Object & { name?: string }).name !== BASE_LAYER_NAME)
    objects.forEach((obj) => c.remove(obj))
    c.renderAll()
    syncTexture()
  }

  const pill = 'rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white transition hover:bg-white/10'
  const activePill = 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
  const tabBtn = (active: boolean) => `flex-1 py-2 text-xs font-medium transition rounded-xl ${active ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`

  const toolsSection = (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
        <button type="button" className={tabBtn(activePanel === 'tools')} onClick={() => setActivePanel('tools')}>绘制工具</button>
        <button type="button" className={tabBtn(activePanel === 'stickers')} onClick={() => setActivePanel('stickers')}>贴纸库</button>
      </div>

      {activePanel === 'tools' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`${pill} ${tool === 'paint' ? activePill : ''}`} onClick={() => setTool('paint')}>画笔</button>
            <button type="button" className={`${pill} ${tool === 'shape' ? activePill : ''}`} onClick={() => setTool('shape')}>形状</button>
            <button type="button" className={`${pill} ${tool === 'text' ? activePill : ''}`} onClick={() => setTool('text')}>文字</button>
            <button type="button" className={pill} onClick={fillAll}>一键填色</button>
          </div>

          <div className="rounded-2xl border border-white/15 bg-black/30 p-3">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
              <span>颜色</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent" />
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {QUICK_COLORS.map((c) => (
                <button key={c} type="button" aria-label={c}
                  className={`h-6 w-6 rounded-full border ${color === c ? 'border-white ring-2 ring-cyan-400/60' : 'border-white/20'}`}
                  style={{ backgroundColor: c }} onClick={() => setColor(c)} />
              ))}
            </div>

            {tool === 'paint' && (
              <>
                <label className="mb-1 block text-xs text-slate-300">笔刷粗细：{brushSize}px</label>
                <input type="range" min={2} max={60} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full" />
              </>
            )}

            {tool === 'shape' && (
              <div className="mt-2 flex gap-2">
                <select className="flex-1 rounded-lg border border-white/20 bg-slate-900/70 px-2 py-2 text-xs text-white"
                  value={shapeType} onChange={(e) => setShapeType(e.target.value as 'rect' | 'circle' | 'line')}>
                  <option value="rect">矩形</option>
                  <option value="circle">圆形</option>
                  <option value="line">线条</option>
                </select>
                <button type="button" className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-xs text-white" onClick={addShape}>添加</button>
              </div>
            )}

            {tool === 'text' && (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <select className="flex-1 rounded-lg border border-white/20 bg-slate-900/70 px-2 py-1.5 text-xs text-white"
                    value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                    {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    <button type="button" className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
                      onClick={() => setFontSize(Math.max(12, fontSize - 8))}>−</button>
                    <span className="min-w-[28px] text-center text-xs text-white">{fontSize}</span>
                    <button type="button" className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
                      onClick={() => setFontSize(Math.min(256, fontSize + 8))}>+</button>
                  </div>
                </div>
                <button type="button" className="w-full rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-xs text-white" onClick={addText}>添加文字</button>
              </div>
            )}
          </div>

          {hasSelection && (
            <div className="flex gap-1.5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-2">
              <span className="mr-1 self-center text-xs text-amber-200">选中：</span>
              <button type="button" className="flex-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-xs text-white hover:bg-white/20" onClick={bringToFront}>置顶</button>
              <button type="button" className="flex-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-xs text-white hover:bg-white/20" onClick={sendToBack}>置底</button>
              <button type="button" className="flex-1 rounded-lg border border-red-400/40 bg-red-500/20 px-2 py-1.5 text-xs text-red-200 hover:bg-red-500/30" onClick={deleteSelected}>删除</button>
            </div>
          )}

          <button type="button" className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs text-slate-400 hover:bg-white/10 hover:text-white transition"
            onClick={clearCanvas}>清空画布</button>
        </>
      )}

      {activePanel === 'stickers' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">点击贴纸添加到画布，可移动 / 缩放 / 旋转</p>
          <div className="grid grid-cols-4 gap-2">
            {STICKERS.map((s) => (
              <button key={s.id} type="button"
                className="flex h-14 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-3xl transition hover:border-cyan-400/50 hover:bg-white/10"
                onClick={() => addSticker(s.label)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const canvasSection = (
    <div className="max-h-[min(72vh,720px)] w-full max-w-[min(96vw,720px)] overflow-hidden rounded-2xl border border-neutral-300 bg-[#090f1a] shadow-md dark:border-white/15">
      <canvas ref={canvasRef} className="block h-auto w-full" />
    </div>
  )

  if (layout === 'studio') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
        <aside className="flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col overflow-y-auto rounded-2xl border border-neutral-200 bg-slate-950 p-3 shadow-sm dark:border-neutral-800 md:max-h-none md:w-[min(100%,320px)]">
          {toolsSection}
        </aside>
        <div className="flex min-h-[min(50vh,380px)] min-w-0 flex-1 items-center justify-center overflow-auto rounded-2xl border border-neutral-200 bg-neutral-100/90 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
          {canvasSection}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {toolsSection}
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#090f1a]">
        <canvas ref={canvasRef} className="block h-auto w-full" />
      </div>
    </div>
  )
})
