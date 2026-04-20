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

export const DEFAULT_WIDTH = 1024
export const DEFAULT_HEIGHT = 1024
const BASE_LAYER_NAME = '__base_fill_layer__'

export type GradientStop = { color: string; offset: number }
export type GradientFill = {
  /** 0–360 deg, 0 = top→bottom, 90 = left→right */
  angle: number
  stops: GradientStop[]
}

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
  fillGradient: (gradient: GradientFill) => void
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
  /** 视口旋转：仅旋转画布视图，不影响纹理输出 */
  rotateCW: () => void
  rotateCCW: () => void
  setRotation: (deg: 0 | 90 | 180 | 270) => void
  getRotation: () => 0 | 90 | 180 | 270
  /** 图层：按创建顺序返回 */
  listLayers: () => LayerSummary[]
  selectLayer: (id: string) => void
  toggleLayerVisibility: (id: string) => void
  removeLayer: (id: string) => void
  /**
   * 重新排序图层。`fromId` 和 `toId` 都是 `LayerSummary.id`。
   * `position` 指拖动后 `fromId` 应停留在 `toId` 的上方还是下方
   * （图层面板视觉顺序：栈顶在上）。
   */
  reorderLayer: (fromId: string, toId: string, position: 'before' | 'after') => void
  /** 取当前选中对象的填充色（仅文本/形状有意义；其它返回 null） */
  getSelectedFill: () => string | null
  /** 修改当前选中对象的填充色（文本/形状）。返回是否成功。 */
  setSelectedFill: (color: string) => boolean
  getCanvas: () => fabric.Canvas | null
  /** Export a clean PNG dataURL (no selection/transform handles, with model-level
   *  rotation applied). Always sources from the lower canvas only so the
   *  download/publish output never contains element bounding boxes. */
  exportTexture: () => string | null
}

export type ActiveObjectInfo = {
  /** 'text' / 'shape' / 'path' / 'image' / 'other' */
  type: LayerSummary['type']
  /** 当前对象的填充色（rgb/hex 字符串，渐变或图案返回 null） */
  fill: string | null
}

export type Canvas2DEditorProps = {
  onSelectionChange?: (hasSelection: boolean) => void
  /** 选中对象变化时触发（含取消选中时为 null） */
  onActiveObjectChange?: (info: ActiveObjectInfo | null) => void
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void
  onZoomChange?: (zoom: number) => void
  onLayersChange?: (layers: LayerSummary[]) => void
  /** 画布宽度（像素），默认 1024 */
  canvasWidth?: number
  /** 画布高度（像素），默认 1024 */
  canvasHeight?: number
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
  /** 视口旋转变化回调（仅显示旋转，不影响纹理） */
  onRotationChange?: (deg: 0 | 90 | 180 | 270) => void
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
 * layers — but the upper canvas ALSO holds selection rectangles & control
 * handles, which would otherwise leak onto the 3D texture as a visible
 * bounding box on the car. Hence we only merge the upper layer when the
 * user is actively drawing.
 */
/**
 * Fast AND clean composite used for live 3D texture sync.
 *
 * Important fabric v5 behaviour: `Canvas.renderCanvas` (and therefore the
 * visible `lowerCanvasEl`, plus `toCanvasElement`) ALWAYS calls
 * `drawControls`, which paints the active object's selection border and
 * corner handles directly into the rendered context. So both
 *   - reading `lowerCanvasEl` directly, and
 *   - calling `canvas.toCanvasElement(1)`
 * end up burning the selection bounding box into the 3D preview.
 *
 * We bypass `renderCanvas` entirely and call the lower-level
 * `_renderObjects` (which powers fabric's render but knows nothing about
 * selection/controls). With `objectCaching` (fabric default) each object
 * just blits a cached bitmap, so this is essentially as fast as a single
 * `drawImage` per object — fast enough to run on every drag frame.
 *
 * `includeUpper` is only ever true while the user is actively mid-stroke
 * with the freehand brush; the in-progress path lives only on the upper
 * canvas until `path:created` promotes it to the lower canvas.
 */
function compositeFabricVisibleCanvas(canvas: fabric.Canvas, includeUpper: boolean): HTMLCanvasElement {
  const w = canvas.width ?? DEFAULT_WIDTH
  const h = canvas.height ?? DEFAULT_HEIGHT
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return out
  const c = canvas as fabric.Canvas & {
    upperCanvasEl?: HTMLCanvasElement
    viewportTransform?: number[]
    _objects?: fabric.Object[]
    _renderObjects?: (ctx: CanvasRenderingContext2D, objects: fabric.Object[]) => void
  }
  const v = c.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  const objects = c._objects ?? canvas.getObjects()
  ctx.save()
  ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5])
  if (typeof c._renderObjects === 'function') {
    c._renderObjects(ctx, objects)
  } else {
    // Defensive fallback for fabric builds that mangle the private API:
    // render each object individually. Same semantics, no controls.
    for (const obj of objects) obj.render(ctx)
  }
  ctx.restore()
  if (includeUpper && c.upperCanvasEl) ctx.drawImage(c.upperCanvasEl, 0, 0)
  return out
}

/**
 * Same render path as `compositeFabricVisibleCanvas` but never merges the
 * upper canvas. Used for texture download / publish where we want exactly
 * "the artwork, nothing else" regardless of editor state.
 */
function exportCleanCanvas(canvas: fabric.Canvas): HTMLCanvasElement {
  return compositeFabricVisibleCanvas(canvas, false)
}

export const Canvas2DEditor = forwardRef<Canvas2DEditorRef, Canvas2DEditorProps>(function Canvas2DEditor(
  {
    onSelectionChange,
    onActiveObjectChange,
    onHistoryChange,
    onZoomChange,
    onLayersChange,
    canvasWidth = DEFAULT_WIDTH,
    canvasHeight = DEFAULT_HEIGHT,
    uvMaskUrl,
    uvMaskNativeWidth,
    uvMaskNativeHeight,
    uvMaskOpacity = 0.35,
    textureRotation = 0,
    workspaceBackground = '#f3f4f6',
    onRotationChange,
  },
  ref
) {
  const WIDTH = canvasWidth
  const HEIGHT = canvasHeight
  const maskNativeW = uvMaskNativeWidth ?? WIDTH
  const maskNativeH = uvMaskNativeHeight ?? HEIGHT
  // Refs so closures captured inside the init `useEffect` (which has empty
  // deps and never re-runs) can read the current dimensions after a model
  // swap — most importantly, the rotation correction inside `getPointer`.
  const widthRef = useRef(WIDTH)
  const heightRef = useRef(HEIGHT)
  useEffect(() => { widthRef.current = WIDTH; heightRef.current = HEIGHT }, [WIDTH, HEIGHT])
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const syncRafRef = useRef<number | null>(null)
  const altDragRef = useRef<{
    target: fabric.Object
    origLeft: number
    origTop: number
    cloned: boolean
  } | null>(null)
  // Tracks the position of the object being dragged at mouse-down, used to
  // implement Shift = axis-lock (constrain motion to dominant axis).
  const moveStartRef = useRef<{ target: fabric.Object; left: number; top: number } | null>(null)
  /** Offscreen canvas reused by `syncTexture` for rotating before encoding. */
  const rotationCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const textureRotationRef = useRef<0 | 90 | 180>(textureRotation)
  useEffect(() => { textureRotationRef.current = textureRotation }, [textureRotation])

  // Zoom/pan
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, tx: 0, ty: 0, userAdjusted: false })
  const viewportRef = useRef(viewport)
  useEffect(() => { viewportRef.current = viewport }, [viewport])

  // View rotation (purely visual; texture export stays unrotated)
  const [rotation, setRotationState] = useState<0 | 90 | 180 | 270>(0)
  const rotationRef = useRef<0 | 90 | 180 | 270>(0)
  useEffect(() => {
    rotationRef.current = rotation
    onRotationChange?.(rotation)
  }, [rotation, onRotationChange])

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
  const toolRef = useRef(tool)
  useEffect(() => { toolRef.current = tool }, [tool])

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
      // Only merge the upper canvas while a brush stroke is actually in
      // progress (between mouse:down and mouse:up). Just being in drawing
      // mode is not enough — otherwise hover/cursor artefacts on the upper
      // canvas would leak into the texture.
      const c2Internal = c2 as fabric.Canvas & { _isCurrentlyDrawing?: boolean }
      const drawing = c2.isDrawingMode === true && c2Internal._isCurrentlyDrawing === true
      const src = compositeFabricVisibleCanvas(c2, drawing)
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
  }, [WIDTH, HEIGHT])

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
  /**
   * When the workspace view is rotated, every newly-inserted object is
   * counter-rotated and re-anchored at the canvas centre so the user always
   * sees an upright element at the spot they just added it. The texture
   * still records the angle in canvas-UV space (which is what the 3D model
   * needs once the canvas is rotated back to 0°).
   */
  const orientNewObject = useCallback((obj: fabric.Object) => {
    const rot = rotationRef.current
    if (!rot) return
    obj.set({
      originX: 'center',
      originY: 'center',
      left: WIDTH / 2,
      top: HEIGHT / 2,
      angle: -rot,
    })
    obj.setCoords()
  }, [WIDTH, HEIGHT])

  const fillAll = useCallback((fillColor: string) => {
    const c = fabricRef.current; if (!c) return
    const layer = ensureBaseFillLayer(); if (!layer) return
    layer.set('fill', fillColor)
    c.sendToBack(layer); c.requestRenderAll(); syncTexture(); snapshot()
  }, [ensureBaseFillLayer, syncTexture, snapshot])

  /**
   * Apply a linear gradient to the always-on base fill layer. Angle is in
   * degrees; 0 = top→bottom, 90 = left→right (CSS-style). The gradient is
   * mapped onto the rectangle's local bounding box so it adapts to whatever
   * canvas size the current model uses.
   */
  const fillGradient = useCallback((g: GradientFill) => {
    const c = fabricRef.current; if (!c) return
    const layer = ensureBaseFillLayer() as fabric.Rect | null
    if (!layer) return
    const w = layer.width ?? WIDTH
    const h = layer.height ?? HEIGHT
    // Convert angle (CSS-style) to two endpoints inside the rect's local space.
    const θ = (g.angle - 90) * Math.PI / 180
    const cx = w / 2
    const cy = h / 2
    const r = Math.sqrt(w * w + h * h) / 2
    const dx = Math.cos(θ) * r
    const dy = Math.sin(θ) * r
    const grad = new fabric.Gradient({
      type: 'linear',
      coords: { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy },
      colorStops: g.stops.map((s) => ({ offset: s.offset, color: s.color })),
    })
    layer.set('fill', grad as unknown as string)
    c.sendToBack(layer); c.requestRenderAll(); syncTexture(); snapshot()
  }, [ensureBaseFillLayer, syncTexture, snapshot, WIDTH, HEIGHT])

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
    orientNewObject(obj)
    c.add(obj); c.setActiveObject(obj); c.requestRenderAll()
  }, [orientNewObject, WIDTH, HEIGHT])

  const addText = useCallback((text: string, fSize: number, fFamily: string, fillColor: string) => {
    const c = fabricRef.current; if (!c) return
    const t = new fabric.IText(text, { left: WIDTH / 2 - 120, top: HEIGHT / 2 - 30, fontSize: fSize, fill: fillColor, fontWeight: '700', fontFamily: fFamily })
    orientNewObject(t)
    c.add(t); c.setActiveObject(t); c.requestRenderAll()
  }, [orientNewObject, WIDTH, HEIGHT])

  const addSticker = useCallback((emoji: string) => {
    const c = fabricRef.current; if (!c) return
    const t = new fabric.IText(emoji, {
      left: WIDTH / 2 - 50 + Math.random() * 60 - 30,
      top: HEIGHT / 2 - 50 + Math.random() * 60 - 30,
      fontSize: 160, selectable: true,
    })
    orientNewObject(t)
    c.add(t); c.setActiveObject(t); c.requestRenderAll()
  }, [orientNewObject, WIDTH, HEIGHT])

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
      orientNewObject(img)
      c.add(img); c.setActiveObject(img); c.requestRenderAll()
      syncTexture()
    }, { crossOrigin: 'anonymous' })
  }, [syncTexture, orientNewObject, WIDTH, HEIGHT])

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

  /* ─── Selection: read / write fill ─────────────────────────────────── */
  const fillOfObject = (o: fabric.Object | undefined | null): string | null => {
    if (!o) return null
    const f = (o as fabric.Object & { fill?: unknown }).fill
    return typeof f === 'string' ? f : null
  }
  const buildActiveInfo = useCallback((c: fabric.Canvas | null): ActiveObjectInfo | null => {
    if (!c) return null
    const a = c.getActiveObject()
    if (!a) return null
    if ((a as fabric.Object & { name?: string }).name === BASE_LAYER_NAME) return null
    return { type: layerType(a), fill: fillOfObject(a) }
  }, [])
  const emitActive = useCallback(() => {
    onActiveObjectChange?.(buildActiveInfo(fabricRef.current))
  }, [buildActiveInfo, onActiveObjectChange])

  const getSelectedFill = useCallback((): string | null => {
    return fillOfObject(fabricRef.current?.getActiveObject() ?? null)
  }, [])
  const setSelectedFill = useCallback((color: string): boolean => {
    const c = fabricRef.current; if (!c) return false
    const a = c.getActiveObject(); if (!a) return false
    if ((a as fabric.Object & { name?: string }).name === BASE_LAYER_NAME) return false
    a.set('fill', color)
    // For IText we must also strip per-character `fill` overrides — otherwise
    // any character that had previously been styled (e.g. via in-place edit)
    // would keep its old color and the change would silently look broken.
    if (a instanceof fabric.IText) {
      const it = a as fabric.IText & { removeStyle?: (key: string) => void }
      it.removeStyle?.('fill')
      a.set('fill', color)
    }
    a.dirty = true
    c.requestRenderAll()
    syncTexture()
    snapshot()
    emitActive()
    return true
  }, [syncTexture, snapshot, emitActive])

  /**
   * Move `fromId` to land immediately before/after `toId` in the panel's
   * visual order (which is fabric stack order reversed: index 0 = topmost).
   * fabric exposes `moveTo(obj, idx)` to set absolute stack position; we
   * compute the target index in fabric-space then guard the immutable base
   * fill layer so it stays at the bottom.
   */
  const reorderLayer = useCallback((fromId: string, toId: string, position: 'before' | 'after') => {
    const c = fabricRef.current; if (!c) return
    if (fromId === toId) return
    const from = findObjectById(fromId)
    const to = findObjectById(toId)
    if (!from || !to) return
    const objects = c.getObjects()
    const baseIdx = objects.findIndex(
      (o) => (o as fabric.Object & { name?: string }).name === BASE_LAYER_NAME
    )
    // Build the editable order (excluding the locked base layer) in panel
    // visual order: top of panel == top of stack.
    const editable = objects
      .map((o, idx) => ({ o, idx }))
      .filter(({ idx }) => idx !== baseIdx)
      .reverse()
    const fromVis = editable.findIndex(({ o }) => o === from)
    const toVis = editable.findIndex(({ o }) => o === to)
    if (fromVis < 0 || toVis < 0) return
    const reordered = editable.map((e) => e.o)
    reordered.splice(fromVis, 1)
    let insertAt = reordered.indexOf(to)
    if (position === 'after') insertAt += 1
    reordered.splice(insertAt, 0, from)
    // Convert visual order back to fabric stack order (bottom→top) and
    // re-apply via `moveTo`. The base layer always stays at index 0.
    const stackOrder = reordered.slice().reverse()
    stackOrder.forEach((obj, i) => {
      const targetIdx = baseIdx >= 0 ? i + 1 : i
      c.moveTo(obj, targetIdx)
    })
    c.requestRenderAll()
    syncTexture()
    snapshot()
    emitLayers()
  }, [findObjectById, syncTexture, snapshot, emitLayers])

  /* ─── Viewport: zoom & pan ──────────────────────────────────────────── */
  const getWorkspaceSize = useCallback(() => {
    const outer = wrapperRef.current
    if (!outer) return { w: 0, h: 0 }
    const r = outer.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }, [])

  // With `transformOrigin: 50% 50%` the visual centre of the canvas always
  // sits at (WIDTH/2 + tx, HEIGHT/2 + ty) regardless of scale OR rotation, so
  // centring is just a constant translation — no need to multiply by `scale`.
  const centerViewport = useCallback(() => {
    const { w, h } = getWorkspaceSize()
    return { tx: (w - WIDTH) / 2, ty: (h - HEIGHT) / 2 }
  }, [getWorkspaceSize, WIDTH, HEIGHT])

  const fitToScreen = useCallback(() => {
    const { w, h } = getWorkspaceSize()
    if (w <= 0 || h <= 0) return
    const padding = 48
    const scale = Math.min((w - padding) / WIDTH, (h - padding) / HEIGHT, 1)
    const { tx, ty } = centerViewport()
    setViewport({ scale, tx, ty, userAdjusted: false })
  }, [getWorkspaceSize, centerViewport, WIDTH, HEIGHT])

  const resetZoom = useCallback(() => {
    const { tx, ty } = centerViewport()
    setViewport({ scale: 1, tx, ty, userAdjusted: true })
  }, [centerViewport])

  // Zoom keeps the canvas centred around its own centre (transformOrigin),
  // so we only need to update the scale — `tx`/`ty` (panning) is preserved.
  const setZoom = useCallback((z: number) => {
    const clamped = Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM)
    setViewport((prev) => ({ ...prev, scale: clamped, userAdjusted: true }))
  }, [])

  const zoomIn = useCallback(() => { setZoom(viewportRef.current.scale * 1.2) }, [setZoom])
  const zoomOut = useCallback(() => { setZoom(viewportRef.current.scale / 1.2) }, [setZoom])

  /* ─── Rotation ──────────────────────────────────────────────────────── */
  const setRotation = useCallback((deg: 0 | 90 | 180 | 270) => {
    setRotationState(deg)
  }, [])
  const rotateCW = useCallback(() => {
    setRotationState((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)
  }, [])
  const rotateCCW = useCallback(() => {
    setRotationState((r) => ((r + 270) % 360) as 0 | 90 | 180 | 270)
  }, [])

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
    addImageFromDataUrl, fillAll, fillGradient, addShape, addText, addSticker,
    deleteSelected, clearCanvas, bringToFront, sendToBack,
    undo, redo,
    setZoom, zoomIn, zoomOut, fitToScreen, resetZoom,
    rotateCW, rotateCCW, setRotation,
    getRotation: () => rotationRef.current,
    listLayers: collectLayers,
    selectLayer, toggleLayerVisibility, removeLayer, reorderLayer,
    getSelectedFill, setSelectedFill,
    getCanvas: () => fabricRef.current,
    exportTexture: () => {
      const c = fabricRef.current
      if (!c) return null
      // Drop any active selection so handles are erased from the upper canvas
      // first, then render every object to a fresh canvas via fabric's clean
      // export. This guarantees the downloaded image never contains
      // selection borders, control handles or other transient UI artefacts.
      c.discardActiveObject()
      c.requestRenderAll()
      const src = exportCleanCanvas(c)
      const rotation = textureRotationRef.current
      if (!rotation) return src.toDataURL('image/png')
      const swap = rotation === 90
      const outW = swap ? src.height : src.width
      const outH = swap ? src.width : src.height
      const off = document.createElement('canvas')
      off.width = outW
      off.height = outH
      const ctx = off.getContext('2d')
      if (!ctx) return src.toDataURL('image/png')
      if (rotation === 180) {
        ctx.translate(outW, outH)
        ctx.rotate(Math.PI)
      } else if (rotation === 90) {
        ctx.translate(outW, 0)
        ctx.rotate(Math.PI / 2)
      }
      ctx.drawImage(src, 0, 0)
      return off.toDataURL('image/png')
    },
  }), [
    brushSize, color, shapeType, tool, fontSize, fontFamily,
    ensureBaseFillLayer, setBrushSize, setColor, setShapeType,
    setFontSize, setFontFamily, syncTexture,
    addImageFromDataUrl, fillAll, fillGradient, addShape, addText, addSticker,
    deleteSelected, clearCanvas, bringToFront, sendToBack,
    undo, redo, setZoom, zoomIn, zoomOut, fitToScreen, resetZoom,
    rotateCW, rotateCCW, setRotation,
    collectLayers, selectLayer, toggleLayerVisibility, removeLayer, reorderLayer,
    getSelectedFill, setSelectedFill,
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

    // Patch `getPointer` so mouse interactions stay accurate when the stage
    // is CSS-rotated. fabric only knows about the axis-aligned bounding rect
    // of the canvas element, so without this monkey-patch every click would
    // land on the wrong object once rotation != 0.
    //
    // CAUTION: fabric's `_cacheTransformEventData` populates `_pointer` /
    // `_absolutePointer` for the duration of a single DOM event, then later
    // `getPointer(e)` calls return the cached value. We MUST mirror that
    // cache short-circuit here, otherwise our rotation correction gets
    // applied twice (once when the cache is populated, once when it's read)
    // and strokes/clicks land at a doubly-rotated position.
    const _getPointer = c.getPointer.bind(c)
    ;(c as fabric.Canvas).getPointer = function (e: Event, ignoreVpt?: boolean) {
      const ce = c as fabric.Canvas & { _pointer?: fabric.Point; _absolutePointer?: fabric.Point }
      if (ce._absolutePointer && !ignoreVpt) return ce._absolutePointer
      if (ce._pointer && ignoreVpt) return ce._pointer
      const p = _getPointer(e as MouseEvent | TouchEvent, ignoreVpt)
      const rot = rotationRef.current
      if (!rot) return p
      const cx = widthRef.current / 2
      const cy = heightRef.current / 2
      const θ = -rot * Math.PI / 180
      const cos = Math.cos(θ)
      const sin = Math.sin(θ)
      const dx = p.x - cx
      const dy = p.y - cy
      return new fabric.Point(cos * dx - sin * dy + cx, sin * dx + cos * dy + cy)
    } as typeof c.getPointer

    c.freeDrawingBrush = new fabric.PencilBrush(c)
    c.freeDrawingBrush.width = 12
    c.freeDrawingBrush.color = '#ff2d55'
    c.isDrawingMode = false

    c.on('selection:created', () => { onSelectionChange?.(true); emitLayers(); emitActive() })
    c.on('selection:updated', () => { onSelectionChange?.(true); emitLayers(); emitActive() })
    c.on('selection:cleared', () => { onSelectionChange?.(false); emitLayers(); emitActive() })

    c.on('path:created', () => { c.requestRenderAll(); syncTexture(); snapshot(); emitLayers() })
    c.on('object:added', () => { syncTexture(); snapshot(); emitLayers() })
    c.on('object:modified', () => { syncTexture(); snapshot(); emitLayers(); emitActive() })
    c.on('object:removed', () => { syncTexture(); snapshot(); emitLayers(); emitActive() })

    /* ─── Alt + 拖拽：复制元素（Figma/Sketch 风格） ────────────────────
     * fabric 在 `mouse:down` 时已经锁定 `_currentTransform`，无法直接把
     * 克隆体替换成新的活动对象去拖拽。所以我们改成：按下时记录原始位置，
     * 第一次 `object:moving` 触发时同步克隆一份放回原位 —— 这样用户拖动
     * 的依旧是原对象，但屏幕上看起来像是「按住 Alt 拖出一份副本」。
     */
    c.on('mouse:down', (opt) => {
      altDragRef.current = null
      moveStartRef.current = null
      const target = opt.target
      if (!target) return
      if ((target as fabric.Object & { name?: string }).name === BASE_LAYER_NAME) return
      const evt = opt.e as MouseEvent | undefined
      if (evt?.altKey) {
        altDragRef.current = {
          target,
          origLeft: target.left ?? 0,
          origTop: target.top ?? 0,
          cloned: false,
        }
      }
      // Always remember the starting position — Shift-axis-lock relies on it.
      moveStartRef.current = {
        target,
        left: target.left ?? 0,
        top: target.top ?? 0,
      }
    })
    c.on('object:moving', (opt) => {
      const ad = altDragRef.current
      if (ad && !ad.cloned && opt.target === ad.target) {
        ad.cloned = true
        ad.target.clone((cloned: fabric.Object) => {
          const cAny = cloned as fabric.Object & { __id?: string }
          cAny.__id = `L${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
          cloned.set({ left: ad.origLeft, top: ad.origTop, evented: true, selectable: true })
          c.add(cloned)
          // Insert clone just below the source so the user keeps dragging the
          // top one — feels like "lifting a copy out".
          const stack = c.getObjects()
          const srcIdx = stack.indexOf(ad.target)
          if (srcIdx >= 0) c.moveTo(cloned, srcIdx)
          c.requestRenderAll()
        }, ['name'])
      }
      // Shift = constrain to dominant axis (Figma/Sketch parity).
      const evt = opt.e as MouseEvent | undefined
      const ms = moveStartRef.current
      if (evt?.shiftKey && ms && ms.target === opt.target) {
        const dx = (opt.target.left ?? 0) - ms.left
        const dy = (opt.target.top ?? 0) - ms.top
        if (Math.abs(dx) >= Math.abs(dy)) {
          opt.target.set('top', ms.top)
        } else {
          opt.target.set('left', ms.left)
        }
        opt.target.setCoords()
      }
    })
    // Shift = snap rotation to 15° increments (matches most design tools).
    c.on('object:rotating', (opt) => {
      const evt = opt.e as MouseEvent | undefined
      ;(opt.target as fabric.Object & { snapAngle?: number }).snapAngle = evt?.shiftKey ? 15 : 0
    })
    c.on('mouse:up', () => {
      altDragRef.current = null
      moveStartRef.current = null
    })
    // Live updates while transforming an object — `syncTexture` is rAF-throttled
    // so the 3D preview tracks the drag/scale/rotate without history spam.
    c.on('object:moving',   () => syncTexture())
    c.on('object:scaling',  () => syncTexture())
    c.on('object:rotating', () => syncTexture())
    c.on('object:skewing',  () => syncTexture())
    c.on('text:changed',    () => syncTexture())

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

  /* ─── Sync canvas dimensions when the parent swaps models ──────────── */
  useEffect(() => {
    const c = fabricRef.current; if (!c) return
    if (c.width === WIDTH && c.height === HEIGHT) return
    c.setDimensions({ width: WIDTH, height: HEIGHT })
    // Stretch the base fill rectangle to the new canvas size so the
    // background stays edge-to-edge after switching models.
    const base = c.getObjects().find(
      (o) => (o as fabric.Object & { name?: string }).name === BASE_LAYER_NAME
    ) as fabric.Rect | undefined
    if (base) {
      base.set({ width: WIDTH, height: HEIGHT, left: 0, top: 0 })
      base.setCoords()
    }
    c.requestRenderAll()
    syncTexture()
    fitToScreen()
  }, [WIDTH, HEIGHT, syncTexture, fitToScreen])

  /* ─── Sync tool / brush to fabric ───────────────────────────────────── */
  useEffect(() => {
    const c = fabricRef.current; if (!c || !c.freeDrawingBrush) return
    const isPaint = tool === 'paint'
    const isErase = tool === 'erase'
    const isPan = tool === 'pan'
    // Allow click-to-select for every tool that doesn't own the pointer
    // (paint / erase consume strokes, pan consumes drag-to-pan).
    const allowSelection = !isPaint && !isErase && !isPan

    c.isDrawingMode = isPaint || isErase
    c.selection = allowSelection
    c.freeDrawingBrush.width = brushSize
    c.freeDrawingBrush.color = isErase ? '#ffffff' : color

    c.getObjects().forEach((o) => {
      const name = (o as fabric.Object & { name?: string }).name
      if (name !== BASE_LAYER_NAME) {
        o.selectable = allowSelection
        o.evented = allowSelection
      }
    })
    c.defaultCursor = isPaint || isErase ? 'crosshair' : isPan ? 'grab' : 'default'
    c.hoverCursor = isPan ? 'grab' : 'move'
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
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      setZoom(viewportRef.current.scale * factor)
    }
    outer.addEventListener('wheel', onWheel, { passive: false })
    return () => outer.removeEventListener('wheel', onWheel)
  }, [setZoom])

  /* ─── Workspace cursor follows the active tool ──────────────────────── */
  useEffect(() => {
    const outer = wrapperRef.current
    if (!outer) return
    if (panStateRef.current.active) return
    outer.style.cursor = tool === 'pan' ? 'grab' : ''
  }, [tool])

  /* ─── Space + drag / middle-mouse pan ───────────────────────────────── */
  useEffect(() => {
    const outer = wrapperRef.current
    if (!outer) return
    const onDown = (e: MouseEvent) => {
      const isMiddle = e.button === 1
      const isPanTool = toolRef.current === 'pan' && e.button === 0
      if (!isSpaceDownRef.current && !isMiddle && !isPanTool) return
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
      const stillGrab = isSpaceDownRef.current || toolRef.current === 'pan'
      outer.style.cursor = stillGrab ? 'grab' : ''
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
        case 'h': setTool('pan'); break
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
   * and the surround dims to a dark wash.
   *
   * If the mask file is oriented differently from the editor canvas
   * (e.g. cybertruck mask is 768×1024 portrait, canvas is 1024×768
   * landscape), we rotate the `<img>` 90° so it visually lines up.
   * Then we stretch its visual bounding box to fill the canvas exactly,
   * so "drawing area === canvas bounds".
   */
  const maskStyle = useMemo<React.CSSProperties | null>(() => {
    if (!uvMaskUrl) return null
    const canvasLandscape = WIDTH > HEIGHT
    const maskLandscape = maskNativeW > maskNativeH
    const needRotate = canvasLandscape !== maskLandscape
    // After a -90° rotation the visual bounding box becomes (height × width)
    // of the layout box. To make the visual fill (WIDTH × HEIGHT), the
    // pre-rotation layout box must be (HEIGHT × WIDTH).
    const boxW = needRotate ? HEIGHT : WIDTH
    const boxH = needRotate ? WIDTH : HEIGHT
    return {
      position: 'absolute',
      left: (WIDTH - boxW) / 2,
      top: (HEIGHT - boxH) / 2,
      width: boxW,
      height: boxH,
      opacity: uvMaskOpacity,
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 5,
      mixBlendMode: 'multiply',
      transform: needRotate ? 'rotate(-90deg)' : undefined,
      transformOrigin: 'center center',
    }
  }, [uvMaskUrl, uvMaskOpacity, maskNativeW, maskNativeH, WIDTH, HEIGHT])

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
          // Order (right-to-left): rotate around canvas centre → scale around
          // canvas centre → translate by (tx, ty). The translate is purely
          // visual so panning behaves identically at every rotation.
          transform: `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.scale}) rotate(${rotation}deg)`,
          transformOrigin: `${WIDTH / 2}px ${HEIGHT / 2}px`,
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
