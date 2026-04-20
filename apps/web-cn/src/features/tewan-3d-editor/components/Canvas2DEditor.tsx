'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { fabric } from 'fabric'
import { useEditorStore } from '../store/useEditorStore'

export const WIDTH = 1024
export const HEIGHT = 1024
const BASE_LAYER_NAME = '__base_fill_layer__'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 6
const HISTORY_MAX = 40

export type LayerSummary = {
  id: string
  name: string
  type: 'image' | 'text' | 'shape' | 'path' | 'other'
  visible: boolean
  locked: boolean
  active: boolean
}

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
  /** 历史：撤销 / 重做 */
  undo: () => void
  redo: () => void
  /** 视口：缩放与平移 */
  setZoom: (zoom: number, anchor?: { x: number; y: number }) => void
  zoomIn: () => void
  zoomOut: () => void
  fitToScreen: () => void
  resetZoom: () => void
  /** 图层：按创建顺序返回 */
  listLayers: () => LayerSummary[]
  selectLayer: (id: string) => void
  toggleLayerVisibility: (id: string) => void
  removeLayer: (id: string) => void
  getCanvas: () => fabric.Canvas | null
}

export type Canvas2DEditorProps = {
  onSelectionChange?: (hasSelection: boolean) => void
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void
  onZoomChange?: (zoom: number) => void
  onLayersChange?: (layers: LayerSummary[]) => void
  /** 半透明 UV 遮罩图片 URL */
  uvMaskUrl?: string
  uvMaskNativeWidth?: number
  uvMaskNativeHeight?: number
  uvMaskOpacity?: number
  /** 0 / 90 / 180 —— OSS pipeline 把 AI 生成图旋转 `textureRotation°` 再贴给 3D，
   *  所以从 fabric 输出到 3D 的纹理也要做同样的旋转。 */
  textureRotation?: 0 | 90 | 180
  /** 画布工作区背景（Canva 风格默认浅灰） */
  workspaceBackground?: string
}

type Viewport = { scale: number; tx: number; ty: number; userAdjusted: boolean }

function layerName(obj: fabric.Object): string {
  const n = (obj as fabric.Object & { name?: string }).name
  if (n && n !== BASE_LAYER_NAME) return n
  if (obj instanceof fabric.IText) return `文字：${obj.text?.slice(0, 12) || ''}`.trim()
  if (obj instanceof fabric.Image) return '图片'
  if (obj instanceof fabric.Rect) return '矩形'
  if (obj instanceof fabric.Circle) return '圆形'
  if (obj instanceof fabric.Line) return '线条'
  if (obj instanceof fabric.Path) return '绘制路径'
  return '图层'
}
function layerType(obj: fabric.Object): LayerSummary['type'] {
  if (obj instanceof fabric.Image) return 'image'
  if (obj instanceof fabric.IText) return 'text'
  if (obj instanceof fabric.Rect || obj instanceof fabric.Circle || obj instanceof fabric.Line) return 'shape'
  if (obj instanceof fabric.Path) return 'path'
  return 'other'
}

function isEditingDomField(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

/**
 * Fabric's `toDataURL` / `toCanvasElement` nulls out `contextTop` and only
 * paints `_objects`. Freehand strokes are drawn on `upperCanvasEl` until
 * `mouse:up`, so exports miss the in-progress brush unless we composite both
 * layers (same pixels the user sees in the editor, minus the DOM UV overlay).
 */
function compositeFabricVisibleCanvas(canvas: fabric.Canvas): HTMLCanvasElement {
  const w = canvas.width ?? WIDTH
  const h = canvas.height ?? HEIGHT
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return out
  const c = canvas as fabric.Canvas & {
    lowerCanvasEl?: HTMLCanvasElement
    upperCanvasEl?: HTMLCanvasElement
  }
  if (c.lowerCanvasEl) ctx.drawImage(c.lowerCanvasEl, 0, 0)
  if (c.upperCanvasEl) ctx.drawImage(c.upperCanvasEl, 0, 0)
  return out
}

export const Canvas2DEditor = forwardRef<Canvas2DEditorRef, Canvas2DEditorProps>(function Canvas2DEditor(
  {
    onSelectionChange,
    onHistoryChange,
    onZoomChange,
    onLayersChange,
    uvMaskUrl,
    uvMaskNativeWidth = WIDTH,
    uvMaskNativeHeight = HEIGHT,
    uvMaskOpacity = 0.35,
    textureRotation = 0,
    workspaceBackground = '#f3f4f6',
  },
  ref
) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const syncRafRef = useRef<number | null>(null)
  /** Offscreen canvas reused by `syncTexture` for rotating before encoding. */
  const rotationCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const textureRotationRef = useRef<0 | 90 | 180>(textureRotation)
  useEffect(() => { textureRotationRef.current = textureRotation }, [textureRotation])

  // Zoom/pan
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, tx: 0, ty: 0, userAdjusted: false })
  const viewportRef = useRef(viewport)
  useEffect(() => { viewportRef.current = viewport }, [viewport])

  const isSpaceDownRef = useRef(false)
  const isMiddleMouseRef = useRef(false)
  const panStateRef = useRef<{ active: boolean; startX: number; startY: number; tx0: number; ty0: number }>({
    active: false, startX: 0, startY: 0, tx0: 0, ty0: 0,
  })

  // History
  const historyRef = useRef<{ stack: string[]; idx: number; locked: boolean }>({
    stack: [], idx: -1, locked: false,
  })
  const [historyTick, setHistoryTick] = useState(0)

  const {
    tool, shapeType, color, brushSize, fontSize, fontFamily,
    setTool, setShapeType, setColor, setBrushSize, setFontSize, setFontFamily,
    setTextureDataUrl,
  } = useEditorStore()

  /* ─── Texture sync (throttled via rAF) ──────────────────────────────── */
  /** Renders the fabric canvas into a reusable offscreen canvas with the
   *  model-specific rotation applied, then emits a dataURL in a single
   *  encode pass. This avoids the old `new Image().onload → canvas → toDataURL`
   *  round-trip that made 3D lag a full decode/encode cycle behind the brush.
   */
  const syncTexture = useCallback(() => {
    const c = fabricRef.current
    if (!c) return
    if (syncRafRef.current) cancelAnimationFrame(syncRafRef.current)
    syncRafRef.current = requestAnimationFrame(() => {
      syncRafRef.current = null
      const c2 = fabricRef.current
      if (!c2) return
      const rotation = textureRotationRef.current
      const src = compositeFabricVisibleCanvas(c2)
      if (!rotation) {
        setTextureDataUrl(src.toDataURL('image/png'))
        return
      }
      const swap = rotation === 90
      const outW = swap ? src.height : src.width
      const outH = swap ? src.width : src.height
      let off = rotationCanvasRef.current
      if (!off) { off = document.createElement('canvas'); rotationCanvasRef.current = off }
      if (off.width !== outW) off.width = outW
      if (off.height !== outH) off.height = outH
      const ctx = off.getContext('2d')
      if (!ctx) { setTextureDataUrl(src.toDataURL('image/png')); return }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, outW, outH)
      if (rotation === 180) {
        ctx.translate(outW, outH)
        ctx.rotate(Math.PI)
      } else if (rotation === 90) {
        ctx.translate(outW, 0)
        ctx.rotate(Math.PI / 2)
      }
      ctx.drawImage(src, 0, 0)
      setTextureDataUrl(off.toDataURL('image/png'))
    })
  }, [setTextureDataUrl])

  /* ─── Base fill layer (always at bottom) ────────────────────────────── */
  const ensureBaseFillLayer = useCallback(() => {
    const c = fabricRef.current
    if (!c) return null
    let layer = c.getObjects().find(
      (o) => (o as fabric.Object & { name?: string }).name === BASE_LAYER_NAME
    )
    if (!layer) {
      layer = new fabric.Rect({
        left: 0, top: 0, width: WIDTH, height: HEIGHT,
        fill: '#ffffff', selectable: false, evented: false, hoverCursor: 'default',
      })
      ;(layer as fabric.Object & { name?: string }).name = BASE_LAYER_NAME
      c.add(layer)
      c.sendToBack(layer)
    }
    return layer
  }, [])

  /* ─── Layer summary ─────────────────────────────────────────────────── */
  const collectLayers = useCallback((): LayerSummary[] => {
    const c = fabricRef.current
    if (!c) return []
    const active = c.getActiveObjects()
    const objects = c.getObjects().filter((o) => (o as fabric.Object & { name?: string }).name !== BASE_LAYER_NAME)
    return objects.map((o, i) => {
      const oAny = o as fabric.Object & { __id?: string; visible?: boolean; lockMovementX?: boolean }
      if (!oAny.__id) oAny.__id = `L${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`
      return {
        id: oAny.__id,
        name: layerName(o),
        type: layerType(o),
        visible: o.visible !== false,
        locked: o.lockMovementX === true,
        active: active.includes(o),
      }
    }).reverse() // Figma/Canva 习惯：栈顶在列表顶部
  }, [])

  const emitLayers = useCallback(() => {
    onLayersChange?.(collectLayers())
  }, [collectLayers, onLayersChange])

  /* ─── History ───────────────────────────────────────────────────────── */
  const snapshot = useCallback(() => {
    const c = fabricRef.current
    if (!c) return
    if (historyRef.current.locked) return
    const json = JSON.stringify(c.toDatalessJSON(['name', '__id']))
    const h = historyRef.current
    if (h.stack[h.idx] === json) return
    h.stack = h.stack.slice(0, h.idx + 1)
    h.stack.push(json)
    if (h.stack.length > HISTORY_MAX) {
      h.stack.shift()
    } else {
      h.idx = h.stack.length - 1
    }
    setHistoryTick((t) => t + 1)
  }, [])

  const restoreHistoryIdx = useCallback((idx: number) => {
    const c = fabricRef.current
    if (!c) return
    const h = historyRef.current
    if (idx < 0 || idx >= h.stack.length) return
    h.locked = true
    const data = h.stack[idx]
    c.loadFromJSON(data, () => {
      ensureBaseFillLayer()
      c.requestRenderAll()
      h.idx = idx
      h.locked = false
      setHistoryTick((t) => t + 1)
      syncTexture()
      emitLayers()
    })
  }, [ensureBaseFillLayer, syncTexture, emitLayers])

  const undo = useCallback(() => {
    const h = historyRef.current
    if (h.idx <= 0) return
    restoreHistoryIdx(h.idx - 1)
  }, [restoreHistoryIdx])

  const redo = useCallback(() => {
    const h = historyRef.current
    if (h.idx >= h.stack.length - 1) return
    restoreHistoryIdx(h.idx + 1)
  }, [restoreHistoryIdx])

  // Emit history state to parent
  useEffect(() => {
    const h = historyRef.current
    onHistoryChange?.({
      canUndo: h.idx > 0,
      canRedo: h.idx < h.stack.length - 1,
    })
  }, [historyTick, onHistoryChange])

  /* ─── Imperative canvas actions ─────────────────────────────────────── */
  const fillAll = useCallback((fillColor: string) => {
    const c = fabricRef.current; if (!c) return
    const layer = ensureBaseFillLayer(); if (!layer) return
    layer.set('fill', fillColor)
    c.sendToBack(layer); c.requestRenderAll(); syncTexture(); snapshot()
  }, [ensureBaseFillLayer, syncTexture, snapshot])

  const addShape = useCallback((sType: 'rect' | 'circle' | 'line', fillColor: string) => {
    const c = fabricRef.current; if (!c) return
    let obj: fabric.Object
    if (sType === 'rect') {
      obj = new fabric.Rect({ left: WIDTH / 2 - 120, top: HEIGHT / 2 - 80, width: 240, height: 160, fill: fillColor, opacity: 0.92, rx: 12, ry: 12 })
    } else if (sType === 'circle') {
      obj = new fabric.Circle({ left: WIDTH / 2 - 100, top: HEIGHT / 2 - 100, radius: 100, fill: fillColor, opacity: 0.92 })
    } else {
      obj = new fabric.Line([WIDTH / 2 - 150, HEIGHT / 2, WIDTH / 2 + 150, HEIGHT / 2], { stroke: fillColor, strokeWidth: 8 })
    }
    c.add(obj); c.setActiveObject(obj); c.requestRenderAll()
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
      fontSize: 160, selectable: true,
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
    const a = c.getActiveObject(); if (a) { c.bringToFront(a); c.requestRenderAll(); syncTexture(); snapshot() }
  }, [syncTexture, snapshot])

  const sendToBack = useCallback(() => {
    const c = fabricRef.current; if (!c) return
    const a = c.getActiveObject()
    if (a) { c.sendBackwards(a, true); ensureBaseFillLayer(); c.requestRenderAll(); syncTexture(); snapshot() }
  }, [ensureBaseFillLayer, syncTexture, snapshot])

  const clearCanvas = useCallback(() => {
    const c = fabricRef.current; if (!c) return
    c.getObjects()
      .filter((o) => (o as fabric.Object & { name?: string }).name !== BASE_LAYER_NAME)
      .forEach((o) => c.remove(o))
    c.requestRenderAll(); syncTexture()
  }, [syncTexture])

  /* ─── Layer ops by id ───────────────────────────────────────────────── */
  const findObjectById = useCallback((id: string): fabric.Object | undefined => {
    const c = fabricRef.current
    if (!c) return undefined
    return c.getObjects().find((o) => (o as fabric.Object & { __id?: string }).__id === id)
  }, [])

  const selectLayer = useCallback((id: string) => {
    const c = fabricRef.current; if (!c) return
    const o = findObjectById(id); if (!o) return
    c.setActiveObject(o); c.requestRenderAll()
  }, [findObjectById])

  const toggleLayerVisibility = useCallback((id: string) => {
    const c = fabricRef.current; if (!c) return
    const o = findObjectById(id); if (!o) return
    o.visible = !(o.visible !== false)
    c.requestRenderAll(); syncTexture(); emitLayers()
  }, [findObjectById, syncTexture, emitLayers])

  const removeLayer = useCallback((id: string) => {
    const c = fabricRef.current; if (!c) return
    const o = findObjectById(id); if (!o) return
    c.remove(o); c.requestRenderAll(); syncTexture()
  }, [findObjectById, syncTexture])

  /* ─── Viewport: zoom & pan ──────────────────────────────────────────── */
  const getWorkspaceSize = useCallback(() => {
    const outer = wrapperRef.current
    if (!outer) return { w: 0, h: 0 }
    const r = outer.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }, [])

  const centerViewport = useCallback((scale: number) => {
    const { w, h } = getWorkspaceSize()
    const tx = (w - WIDTH * scale) / 2
    const ty = (h - HEIGHT * scale) / 2
    return { tx, ty }
  }, [getWorkspaceSize])

  const fitToScreen = useCallback(() => {
    const { w, h } = getWorkspaceSize()
    if (w <= 0 || h <= 0) return
    const padding = 48
    const scale = Math.min((w - padding) / WIDTH, (h - padding) / HEIGHT, 1)
    const { tx, ty } = centerViewport(scale)
    setViewport({ scale, tx, ty, userAdjusted: false })
  }, [getWorkspaceSize, centerViewport])

  const resetZoom = useCallback(() => {
    const { tx, ty } = centerViewport(1)
    setViewport({ scale: 1, tx, ty, userAdjusted: true })
  }, [centerViewport])

  const setZoom = useCallback((z: number, anchor?: { x: number; y: number }) => {
    const clamped = Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM)
    const v = viewportRef.current
    if (anchor) {
      // keep anchor point fixed in viewport
      const k = clamped / v.scale
      const tx = anchor.x - (anchor.x - v.tx) * k
      const ty = anchor.y - (anchor.y - v.ty) * k
      setViewport({ scale: clamped, tx, ty, userAdjusted: true })
    } else {
      const { tx, ty } = centerViewport(clamped)
      setViewport({ scale: clamped, tx, ty, userAdjusted: true })
    }
  }, [centerViewport])

  const zoomIn = useCallback(() => { setZoom(viewportRef.current.scale * 1.2) }, [setZoom])
  const zoomOut = useCallback(() => { setZoom(viewportRef.current.scale / 1.2) }, [setZoom])

  // Emit zoom changes
  useEffect(() => { onZoomChange?.(viewport.scale) }, [viewport.scale, onZoomChange])

  /* ─── Initial fit + responsive fit (only when user hasn't zoomed) ───── */
  useLayoutEffect(() => {
    fitToScreen()
    const outer = wrapperRef.current
    if (!outer) return
    const obs = new ResizeObserver(() => {
      if (!viewportRef.current.userAdjusted) fitToScreen()
    })
    obs.observe(outer)
    return () => obs.disconnect()
  }, [fitToScreen])

  /* ─── Expose ref ────────────────────────────────────────────────────── */
  useImperativeHandle(ref, () => ({
    exportProject: () => {
      const c = fabricRef.current; if (!c) return null
      return { version: 1, canvas: c.toDatalessJSON(['name', '__id']), toolState: { tool, shapeType, color, brushSize, fontSize, fontFamily } }
    },
    importProject: async (project) => {
      const c = fabricRef.current; if (!c) return
      historyRef.current.locked = true
      await new Promise<void>((resolve) => {
        c.loadFromJSON(project.canvas as Record<string, unknown>, () => {
          ensureBaseFillLayer(); c.requestRenderAll(); resolve()
        })
      })
      setShapeType(project.toolState.shapeType); setColor(project.toolState.color)
      setBrushSize(project.toolState.brushSize)
      if (project.toolState.fontSize) setFontSize(project.toolState.fontSize)
      if (project.toolState.fontFamily) setFontFamily(project.toolState.fontFamily)
      historyRef.current.locked = false
      snapshot()
      syncTexture()
      emitLayers()
    },
    addImageFromDataUrl, fillAll, addShape, addText, addSticker,
    deleteSelected, clearCanvas, bringToFront, sendToBack,
    undo, redo,
    setZoom, zoomIn, zoomOut, fitToScreen, resetZoom,
    listLayers: collectLayers,
    selectLayer, toggleLayerVisibility, removeLayer,
    getCanvas: () => fabricRef.current,
  }), [
    brushSize, color, shapeType, tool, fontSize, fontFamily,
    ensureBaseFillLayer, setBrushSize, setColor, setShapeType,
    setFontSize, setFontFamily, syncTexture,
    addImageFromDataUrl, fillAll, addShape, addText, addSticker,
    deleteSelected, clearCanvas, bringToFront, sendToBack,
    undo, redo, setZoom, zoomIn, zoomOut, fitToScreen, resetZoom,
    collectLayers, selectLayer, toggleLayerVisibility, removeLayer,
    emitLayers, snapshot,
  ])

  /* ─── Init fabric canvas ────────────────────────────────────────────── */
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return
    const c = new fabric.Canvas(canvasRef.current, {
      width: WIDTH, height: HEIGHT,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      enableRetinaScaling: false,
      fireRightClick: true,
      stopContextMenu: true,
    })
    fabricRef.current = c
    ensureBaseFillLayer()

    c.freeDrawingBrush = new fabric.PencilBrush(c)
    c.freeDrawingBrush.width = 12
    c.freeDrawingBrush.color = '#ff2d55'
    c.isDrawingMode = false

    c.on('selection:created', () => { onSelectionChange?.(true); emitLayers() })
    c.on('selection:updated', () => { onSelectionChange?.(true); emitLayers() })
    c.on('selection:cleared', () => { onSelectionChange?.(false); emitLayers() })

    c.on('path:created', () => { c.requestRenderAll(); syncTexture(); snapshot(); emitLayers() })
    c.on('object:added', () => { syncTexture(); snapshot(); emitLayers() })
    c.on('object:modified', () => { syncTexture(); snapshot(); emitLayers() })
    c.on('object:removed', () => { syncTexture(); snapshot(); emitLayers() })

    // While drawing, strokes live on upperCanvasEl only — sync every move;
    // syncTexture coalesces to one export per animation frame via rAF.
    c.on('mouse:move', () => {
      if (!c.isDrawingMode) return
      syncTexture()
    })
    c.on('mouse:up', () => { if (c.isDrawingMode) syncTexture() })

    syncTexture()
    snapshot()
    emitLayers()

    return () => {
      if (syncRafRef.current) cancelAnimationFrame(syncRafRef.current)
      c.dispose()
      fabricRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ─── Sync tool / brush to fabric ───────────────────────────────────── */
  useEffect(() => {
    const c = fabricRef.current; if (!c || !c.freeDrawingBrush) return
    const isPaint = tool === 'paint'
    const isErase = tool === 'erase'
    const isSelect = tool === 'select'

    c.isDrawingMode = isPaint || isErase
    c.selection = isSelect
    c.freeDrawingBrush.width = brushSize
    c.freeDrawingBrush.color = isErase ? '#ffffff' : color

    c.getObjects().forEach((o) => {
      const name = (o as fabric.Object & { name?: string }).name
      if (name !== BASE_LAYER_NAME) {
        o.selectable = isSelect
        o.evented = isSelect
      }
    })
    c.defaultCursor = isPaint || isErase ? 'crosshair' : 'default'
    c.requestRenderAll()
  }, [tool, brushSize, color])

  /* ─── Sync active text styling ──────────────────────────────────────── */
  useEffect(() => {
    const c = fabricRef.current; if (!c) return
    const a = c.getActiveObject()
    if (a instanceof fabric.IText) { a.set({ fontSize, fontFamily }); c.requestRenderAll(); syncTexture() }
  }, [fontSize, fontFamily, syncTexture])

  /* ─── Wheel zoom on workspace ───────────────────────────────────────── */
  useEffect(() => {
    const outer = wrapperRef.current
    if (!outer) return
    const onWheel = (e: WheelEvent) => {
      // Ctrl/Cmd + wheel: zoom; plain wheel: allow default scroll if any
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const rect = outer.getBoundingClientRect()
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      setZoom(viewportRef.current.scale * factor, anchor)
    }
    outer.addEventListener('wheel', onWheel, { passive: false })
    return () => outer.removeEventListener('wheel', onWheel)
  }, [setZoom])

  /* ─── Space + drag / middle-mouse pan ───────────────────────────────── */
  useEffect(() => {
    const outer = wrapperRef.current
    if (!outer) return
    const onDown = (e: MouseEvent) => {
      const isMiddle = e.button === 1
      if (!isSpaceDownRef.current && !isMiddle) return
      e.preventDefault()
      if (isMiddle) isMiddleMouseRef.current = true
      const v = viewportRef.current
      panStateRef.current = {
        active: true, startX: e.clientX, startY: e.clientY, tx0: v.tx, ty0: v.ty,
      }
      outer.style.cursor = 'grabbing'
    }
    const onMove = (e: MouseEvent) => {
      const p = panStateRef.current
      if (!p.active) return
      const dx = e.clientX - p.startX
      const dy = e.clientY - p.startY
      setViewport((prev) => ({ ...prev, tx: p.tx0 + dx, ty: p.ty0 + dy, userAdjusted: true }))
    }
    const onUp = () => {
      if (!panStateRef.current.active) return
      panStateRef.current.active = false
      isMiddleMouseRef.current = false
      outer.style.cursor = isSpaceDownRef.current ? 'grab' : ''
    }
    outer.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      outer.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  /* ─── Global keyboard shortcuts ─────────────────────────────────────── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditingDomField()) return
      const c = fabricRef.current
      // fabric IText editing
      if (c && c.getActiveObject() instanceof fabric.IText && (c.getActiveObject() as fabric.IText).isEditing) return

      const cmd = e.metaKey || e.ctrlKey

      if (e.code === 'Space' && !e.repeat) {
        isSpaceDownRef.current = true
        const outer = wrapperRef.current
        if (outer) outer.style.cursor = 'grab'
        e.preventDefault()
        return
      }

      if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (cmd && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return }

      if (cmd && e.key === '=') { e.preventDefault(); zoomIn(); return }
      if (cmd && e.key === '-') { e.preventDefault(); zoomOut(); return }
      if (cmd && e.key === '0') { e.preventDefault(); fitToScreen(); return }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (c && c.getActiveObject()) { e.preventDefault(); deleteSelected() }
        return
      }

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break
        case 'b': setTool('paint'); break
        case 'e': setTool('erase'); break
        case 'r': setTool('shape'); break
        case 't': setTool('text'); break
        case 's': setTool('sticker'); break
        case '[': setBrushSize(Math.max(2, brushSize - 2)); break
        case ']': setBrushSize(Math.min(80, brushSize + 2)); break
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceDownRef.current = false
        const outer = wrapperRef.current
        if (outer && !panStateRef.current.active) outer.style.cursor = ''
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [brushSize, deleteSelected, fitToScreen, redo, setBrushSize, setTool, undo, zoomIn, zoomOut])

  /* ─── UV mask layout (mirrors viewport) ───────────────────────────────
   * The mask is an RGB image (black background / white car panels). We
   * `multiply` it over the artwork so the white panels become transparent
   * (white × anything = anything) while the black surround covers the
   * out-of-body area with a dark wash — exactly the "car visible, outside
   * masked off" look of the original overlay. Orientation matches the
   * fabric canvas directly; rotation to the 3D UV space is applied at
   * texture export time in `syncTexture`.
   */
  const maskStyle = useMemo<React.CSSProperties | null>(() => {
    if (!uvMaskUrl) return null
    return {
      position: 'absolute',
      left: (WIDTH - uvMaskNativeWidth) / 2,
      top: (HEIGHT - uvMaskNativeHeight) / 2,
      width: uvMaskNativeWidth,
      height: uvMaskNativeHeight,
      opacity: uvMaskOpacity,
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 5,
      mixBlendMode: 'multiply',
    }
  }, [uvMaskUrl, uvMaskNativeWidth, uvMaskNativeHeight, uvMaskOpacity])

  /* ─── Render ────────────────────────────────────────────────────────── */
  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full overflow-hidden"
      style={{
        background: workspaceBackground,
        backgroundImage:
          'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div
        ref={stageRef}
        className="absolute top-0 left-0"
        style={{
          width: WIDTH,
          height: HEIGHT,
          transform: `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08)',
          background: '#ffffff',
          borderRadius: 2,
        }}
      >
        <canvas ref={canvasRef} />
        {uvMaskUrl && maskStyle && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={uvMaskUrl} alt="UV 模板" draggable={false} style={maskStyle} />
        )}
      </div>
    </div>
  )
})
