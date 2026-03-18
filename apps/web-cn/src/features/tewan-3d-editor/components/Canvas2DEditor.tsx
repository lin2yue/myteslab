'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { fabric } from 'fabric'
import { useEditorStore } from '../store/useEditorStore'

const WIDTH = 1024
const HEIGHT = 1024

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

  const bg = useMemo(() => '#111827', [])

  const syncTexture = useCallback(() => {
    const c = fabricCanvasRef.current
    if (!c) return
    setTextureDataUrl(c.toDataURL({ format: 'png', multiplier: 1 }))
  }, [setTextureDataUrl])

  useImperativeHandle(
    ref,
    () => ({
      exportProject: () => {
        const c = fabricCanvasRef.current
        if (!c) return null
        return {
          version: 1,
          canvas: c.toDatalessJSON(),
          toolState: {
            tool,
            shapeType,
            color,
            brushSize
          }
        }
      },
      importProject: async (project) => {
        const c = fabricCanvasRef.current
        if (!c) return
        await new Promise<void>((resolve) => {
          c.loadFromJSON(project.canvas as Record<string, unknown>, () => {
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
    [brushSize, color, shapeType, tool, setBrushSize, setColor, setShapeType, setTool, syncTexture]
  )

  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return

    const c = new fabric.Canvas(canvasRef.current, {
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: bg,
      preserveObjectStacking: true
    })

    c.freeDrawingBrush = new fabric.PencilBrush(c)
    c.freeDrawingBrush.width = brushSize
    c.freeDrawingBrush.color = color
    c.isDrawingMode = true

    c.on('object:added', syncTexture)
    c.on('object:modified', syncTexture)
    c.on('object:removed', syncTexture)
    c.on('path:created', syncTexture)

    fabricCanvasRef.current = c
    syncTexture()

    return () => {
      c.dispose()
      fabricCanvasRef.current = null
    }
  }, [bg, brushSize, color, syncTexture])

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
    c.setBackgroundColor(color, () => c.renderAll())
    syncTexture()
  }

  const addShape = () => {
    const c = fabricCanvasRef.current
    if (!c) return

    if (shapeType === 'rect') {
      c.add(
        new fabric.Rect({
          left: WIDTH / 2 - 120,
          top: HEIGHT / 2 - 80,
          width: 240,
          height: 160,
          fill: color,
          opacity: 0.9,
          rx: 8,
          ry: 8
        })
      )
    } else {
      c.add(
        new fabric.Circle({
          left: WIDTH / 2 - 100,
          top: HEIGHT / 2 - 100,
          radius: 100,
          fill: color,
          opacity: 0.9
        })
      )
    }
    c.renderAll()
  }

  const addText = () => {
    const c = fabricCanvasRef.current
    if (!c) return
    c.add(
      new fabric.IText('Tewan 3D', {
        left: WIDTH / 2 - 140,
        top: HEIGHT / 2 - 20,
        fontSize: 64,
        fill: color,
        fontWeight: '700'
      })
    )
    c.renderAll()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 p-3 text-sm">
        <button className="rounded bg-gray-700 px-3 py-1" onClick={fillAll}>一键填色</button>
        <button className={`rounded px-3 py-1 ${tool === 'paint' ? 'bg-pink-600' : 'bg-gray-700'}`} onClick={() => setTool('paint')}>画笔</button>
        <button className={`rounded px-3 py-1 ${tool === 'shape' ? 'bg-pink-600' : 'bg-gray-700'}`} onClick={() => setTool('shape')}>形状</button>
        <button className={`rounded px-3 py-1 ${tool === 'text' ? 'bg-pink-600' : 'bg-gray-700'}`} onClick={() => setTool('text')}>文字</button>

        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded" />

        <label className="ml-1 inline-flex items-center gap-2 text-gray-300">
          笔刷
          <input
            type="range"
            min={2}
            max={60}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
        </label>

        {tool === 'shape' && (
          <select
            className="rounded bg-gray-800 px-2 py-1"
            value={shapeType}
            onChange={(e) => setShapeType(e.target.value as 'rect' | 'circle')}
          >
            <option value="rect">矩形</option>
            <option value="circle">圆形</option>
          </select>
        )}

        {tool === 'shape' && <button className="rounded bg-indigo-600 px-3 py-1" onClick={addShape}>添加形状</button>}
        {tool === 'text' && <button className="rounded bg-indigo-600 px-3 py-1" onClick={addText}>添加文字</button>}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-800 bg-black">
        <canvas ref={canvasRef} className="block h-auto w-full max-w-[512px]" />
      </div>
    </div>
  )
})
