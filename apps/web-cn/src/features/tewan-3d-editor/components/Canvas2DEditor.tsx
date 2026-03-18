'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { fabric } from 'fabric'
import { useEditorStore } from '../store/useEditorStore'

const WIDTH = 1024
const HEIGHT = 1024
const BASE_LAYER_NAME = '__base_fill_layer__'
const QUICK_COLORS = ['#ffffff', '#0f172a', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7']

export type EditorProjectData = {
  version: 1
  canvas: Record<string, unknown>
  toolState: {
    tool: 'paint' | 'shape' | 'text'
    shapeType: 'rect' | 'circle'
    color: string
    brushSize: number
  }
}

export type Canvas2DEditorRef = {
  exportProject: () => EditorProjectData | null
  importProject: (project: EditorProjectData) => Promise<void>
}

export const Canvas2DEditor = forwardRef<Canvas2DEditorRef>(function Canvas2DEditor(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const rafSyncRef = useRef<number | null>(null)

  const {
    tool,
    shapeType,
    color,
    brushSize,
    setTool,
    setShapeType,
    setColor,
    setBrushSize,
    setTextureDataUrl
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
        left: 0,
        top: 0,
        width: WIDTH,
        height: HEIGHT,
        fill: '#111827',
        selectable: false,
        evented: false,
        hoverCursor: 'default'
      })
      ;(layer as fabric.Object & { name?: string }).name = BASE_LAYER_NAME
      c.add(layer)
      c.sendToBack(layer)
    }

    return layer
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      exportProject: () => {
        const c = fabricCanvasRef.current
        if (!c) return null
        return {
          version: 1,
          canvas: c.toDatalessJSON(['name']),
          toolState: { tool, shapeType, color, brushSize }
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
        syncTexture()
      }
    }),
    [brushSize, color, shapeType, tool, ensureBaseFillLayer, setBrushSize, setColor, setShapeType, setTool, syncTexture]
  )

  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return

    const c = new fabric.Canvas(canvasRef.current, {
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: bg,
      preserveObjectStacking: true
    })

    fabricCanvasRef.current = c
    ensureBaseFillLayer()

    c.freeDrawingBrush = new fabric.PencilBrush(c)
    c.freeDrawingBrush.width = brushSize
    c.freeDrawingBrush.color = color
    c.isDrawingMode = true

    c.on('object:added', syncTexture)
    c.on('object:modified', syncTexture)
    c.on('object:removed', syncTexture)
    c.on('path:created', syncTexture)
    c.on('mouse:move', () => {
      if (c.isDrawingMode && c.isDrawingMode) syncTextureThrottled()
    })
    c.on('after:render', syncTextureThrottled)

    syncTexture()

    return () => {
      if (rafSyncRef.current) cancelAnimationFrame(rafSyncRef.current)
      c.dispose()
      fabricCanvasRef.current = null
    }
  }, [bg, brushSize, color, ensureBaseFillLayer, syncTexture, syncTextureThrottled])

  useEffect(() => {
    const c = fabricCanvasRef.current
    if (!c || !c.freeDrawingBrush) return
    c.isDrawingMode = tool === 'paint'
    c.freeDrawingBrush.width = brushSize
    c.freeDrawingBrush.color = color
  }, [tool, brushSize, color])

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
    } else {
      c.add(new fabric.Circle({ left: WIDTH / 2 - 100, top: HEIGHT / 2 - 100, radius: 100, fill: color, opacity: 0.92 }))
    }
    c.renderAll()
  }

  const addText = () => {
    const c = fabricCanvasRef.current
    if (!c) return
    c.add(new fabric.IText('TESLA', { left: WIDTH / 2 - 120, top: HEIGHT / 2 - 20, fontSize: 68, fill: color, fontWeight: '700', fontFamily: 'Inter' }))
    c.renderAll()
  }

  const pill = 'rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white transition hover:bg-white/10'
  const active = 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button className={pill} onClick={fillAll}>一键填色</button>
        <button className={`${pill} ${tool === 'paint' ? active : ''}`} onClick={() => setTool('paint')}>画笔</button>
        <button className={`${pill} ${tool === 'shape' ? active : ''}`} onClick={() => setTool('shape')}>形状</button>
        <button className={`${pill} ${tool === 'text' ? active : ''}`} onClick={() => setTool('text')}>文字</button>
      </div>

      <div className="rounded-2xl border border-white/15 bg-black/30 p-3">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
          <span>颜色与笔刷</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent" />
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_COLORS.map((c) => (
            <button
              key={c}
              aria-label={c}
              className={`h-6 w-6 rounded-full border ${color === c ? 'border-white ring-2 ring-cyan-400/60' : 'border-white/30'}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <label className="mb-2 block text-xs text-slate-300">笔刷粗细：{brushSize}</label>
        <input type="range" min={2} max={60} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full" />

        {tool === 'shape' && (
          <div className="mt-3 flex gap-2">
            <select className="flex-1 rounded-lg border border-white/20 bg-slate-900/70 px-2 py-2 text-xs" value={shapeType} onChange={(e) => setShapeType(e.target.value as 'rect' | 'circle')}>
              <option value="rect">矩形</option>
              <option value="circle">圆形</option>
            </select>
            <button className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-xs" onClick={addShape}>添加</button>
          </div>
        )}

        {tool === 'text' && <button className="mt-3 w-full rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-xs" onClick={addText}>添加文字</button>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#090f1a]">
        <canvas ref={canvasRef} className="block h-auto w-full" />
      </div>
    </div>
  )
})
