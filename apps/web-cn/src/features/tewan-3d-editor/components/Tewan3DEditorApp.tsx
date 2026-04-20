'use client'

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  // Top bar
  Undo2, Redo2, Download, Box, Send, ChevronDown,
  // Left rail
  Droplet, Sparkles, Smile, ImageUp, Type, Pencil, Layers,
  PanelLeftClose, MousePointer2, Hand,
  // Context bar / elements
  Eraser, Square, Circle as CircleIcon,
  Minus, PaintBucket, Trash2,
  ArrowUp, ArrowDown, Eye, EyeOff, GripVertical,
  // Zoom / 3D controls
  ZoomIn, ZoomOut, Maximize2, Moon, Sun, RotateCw, RotateCcw, Pause,
  X, Wand2, Plus,
} from 'lucide-react'
import Link from 'next/link'
import { Canvas2DEditor, Canvas2DEditorRef, LayerSummary, ActiveObjectInfo } from './Canvas2DEditor'
import type { GradientFill } from './Canvas2DEditor'
import { CarPreview3D } from './CarPreview3D'
import { DraggablePanel3D } from './DraggablePanel3D'
import { useEditorStore, type LeftPanel } from '../store/useEditorStore'
import { DEFAULT_MODELS, type ModelConfig } from '@/config/models'
import PublishModal, { type MarketplaceOptions } from '@/components/publish/PublishModal'
import { useAlert } from '@/components/alert/AlertProvider'
import { resolveModelAssetUrl } from '@/lib/editor/resolve-model-asset-url'
import { useRouter } from 'next/navigation'

/* ───────── constants ───────── */
const QUICK_STYLES = [
  { id: 'police', label: '警察涂装', prompt: '警察车身彩绘，蓝白条纹，官方徽章，应急车辆标志', icon: '🚔' },
  { id: 'racing', label: '赛车涂装', prompt: '赛车彩绘，大胆赞助商贴花，赛车条纹，编号板，性能图案', icon: '🏎️' },
  { id: 'christmas', label: '圣诞主题', prompt: '圣诞节主题，红绿配色，雪花，糖果棍，节日装饰', icon: '🎄' },
  { id: 'cyberpunk', label: '赛博朋克', prompt: '赛博朋克风格，霓虹灯线条，暗色底，电路板图案，未来科技感', icon: '⚡' },
  { id: 'carbon', label: '碳纤维', prompt: '碳纤维纹理，深黑色，织物编织感，高端运动风', icon: '🔲' },
  { id: 'matte-black', label: '哑光纯黑', prompt: '哑光纯黑车身，低调奢华，简约风格', icon: '⬛' },
  { id: 'chrome', label: '镭射极光', prompt: '镭射极光渐变，彩虹色金属光泽，反光炫彩', icon: '🌈' },
  { id: 'camo', label: '迷彩涂装', prompt: '军事迷彩风格，绿色褐色黑色斑块，丛林伪装图案', icon: '🪖' },
]

const PALETTE: { label: string; colors: string[] }[] = [
  { label: '基础', colors: ['#ffffff', '#000000', '#9ca3af', '#6b7280', '#374151'] },
  { label: '暖色', colors: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#fb7185'] },
  { label: '冷色', colors: ['#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1'] },
  { label: '渐变', colors: ['#8b5cf6', '#ec4899', '#d946ef', '#a855f7', '#7c3aed'] },
]

const FONT_FAMILIES = ['Inter', 'Arial', 'Georgia', 'Courier New', 'Impact', 'Times New Roman']

const STICKERS = [
  '🔥', '⚡', '🏁', '⭐', '💀', '👑', '💎', '🚀',
  '🎯', '🦅', '🐉', '🌊', '☠️', '🎪', '🏆', '🎸',
  '🌸', '🌈', '☀️', '🌙', '❤️', '💀', '🦋', '🐅',
]

const TEXT_PRESETS: { id: string; label: string; fontSize: number; fontFamily: string; preview: string }[] = [
  { id: 'display', label: '展示标题', fontSize: 120, fontFamily: 'Impact', preview: 'DISPLAY' },
  { id: 'heading', label: '粗标题',  fontSize: 88,  fontFamily: 'Inter',  preview: '粗体标题' },
  { id: 'subheading', label: '副标题', fontSize: 60, fontFamily: 'Inter',  preview: '副标题' },
  { id: 'body',    label: '正文',    fontSize: 42,  fontFamily: 'Inter',  preview: '正文文字' },
]

/* ───────── helpers ───────── */
function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

/* `/api/wrap/save-image` enforces a body cap; mirror AI 设计页 by transcoding
 * to JPEG until the JSON envelope fits. Keeps publish flow stable for big
 * 2048×2048 textures. */
const DIY_SAVE_MAX_PAYLOAD_BYTES = 850 * 1024
const DIY_SAVE_QUALITY_STEPS = [0.9, 0.82, 0.72]
function convertDataUrlToJpeg(dataUrl: string, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.onload = () => {
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas ctx unavailable')); return }
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = dataUrl
  })
}
async function normalizeDiyUploadDataUrl(dataUrl: string): Promise<string> {
  const sizeOf = (img: string) =>
    JSON.stringify({ modelSlug: 'x', imageBase64: img, prompt: 'x' }).length
  if (sizeOf(dataUrl) <= DIY_SAVE_MAX_PAYLOAD_BYTES) return dataUrl
  let out = dataUrl
  for (const q of DIY_SAVE_QUALITY_STEPS) {
    out = await convertDataUrlToJpeg(dataUrl, q)
    if (sizeOf(out) <= DIY_SAVE_MAX_PAYLOAD_BYTES) return out
  }
  return out
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Tewan3DEditorApp — Canva 风格贴膜工作台
 * ═══════════════════════════════════════════════════════════════════════ */
export function Tewan3DEditorApp({ models: propModels }: { models?: ModelConfig[] } = {}) {
  const MODELS = propModels && propModels.length > 0 ? propModels : DEFAULT_MODELS

  /* Store */
  const textureDataUrl = useEditorStore((s) => s.textureDataUrl)
  const lightingMode = useEditorStore((s) => s.lightingMode)
  const setLightingMode = useEditorStore((s) => s.setLightingMode)
  const autoRotate = useEditorStore((s) => s.autoRotate)
  const setAutoRotate = useEditorStore((s) => s.setAutoRotate)
  const aiGenerating = useEditorStore((s) => s.aiGenerating)
  const setAiGenerating = useEditorStore((s) => s.setAiGenerating)
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const shapeType = useEditorStore((s) => s.shapeType)
  const setShapeType = useEditorStore((s) => s.setShapeType)
  const color = useEditorStore((s) => s.color)
  const setColor = useEditorStore((s) => s.setColor)
  const brushSize = useEditorStore((s) => s.brushSize)
  const setBrushSize = useEditorStore((s) => s.setBrushSize)
  const fontSize = useEditorStore((s) => s.fontSize)
  const setFontSize = useEditorStore((s) => s.setFontSize)
  const fontFamily = useEditorStore((s) => s.fontFamily)
  const setFontFamily = useEditorStore((s) => s.setFontFamily)
  const leftPanel = useEditorStore((s) => s.leftPanel)
  const setLeftPanel = useEditorStore((s) => s.setLeftPanel)
  const panel3DVisible = useEditorStore((s) => s.panel3DVisible)
  const setPanel3DVisible = useEditorStore((s) => s.setPanel3DVisible)

  /* Refs & local state */
  const editorRef = useRef<Canvas2DEditorRef>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedModelSlug, setSelectedModelSlug] = useState(MODELS[0]?.slug ?? '')
  const [hasSelection, setHasSelection] = useState(false)
  const [history, setHistory] = useState({ canUndo: false, canRedo: false })
  const [zoom, setZoom] = useState(1)
  const [canvasRotation, setCanvasRotation] = useState<0 | 90 | 180 | 270>(0)
  const [layers, setLayers] = useState<LayerSummary[]>([])
  const [showUVMask, setShowUVMask] = useState(true)
  const [uvMaskOpacity, setUVMaskOpacity] = useState(0.3)
  const [mobile3dOpen, setMobile3dOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGeneratedUrl, setAiGeneratedUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  /* Publish-to-community state */
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [activeWrapId, setActiveWrapId] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishTextureUrl, setPublishTextureUrl] = useState<string | null>(null)

  /* 底色面板：渐变填色（支持多色节点 + 拖动位置） */
  type GradStop = { id: string; color: string; offset: number }
  const makeStopId = () => `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const [gradientStops, setGradientStops] = useState<GradStop[]>([
    { id: 'g1', color: '#ff2d55', offset: 0 },
    { id: 'g2', color: '#ffd166', offset: 1 },
  ])
  const [gradientAngle, setGradientAngle] = useState(180)
  const [activeStopId, setActiveStopId] = useState<string>('g1')

  /* 图层面板拖拽排序 */
  const [dragLayerId, setDragLayerId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<{ id: string; position: 'before' | 'after' } | null>(null)

  /* 当前选中对象信息（用于上下文栏的文本/形状颜色编辑） */
  const [activeInfo, setActiveInfo] = useState<ActiveObjectInfo | null>(null)
  const alert = useAlert()
  const router = useRouter()

  const selectedModel = useMemo(
    () => MODELS.find((m) => m.slug === selectedModelSlug) ?? MODELS[0],
    [selectedModelSlug, MODELS]
  )

  /**
   * Cybertruck wraps to a 1024×768 final UV texture (the body GLB samples
   * a landscape sheet), so the editor canvas mirrors that aspect to avoid
   * wasted vertical space and to keep brush-strokes 1:1 with the texture.
   * Other models keep the existing 1024² square canvas.
   */
  const { canvasWidth, canvasHeight } = useMemo(() => {
    if (selectedModel?.slug === 'cybertruck') return { canvasWidth: 1024, canvasHeight: 768 }
    return { canvasWidth: 1024, canvasHeight: 1024 }
  }, [selectedModel?.slug])

  /** `textureDataUrl` is already rotated inside Canvas2DEditor's `syncTexture`,
   *  so we can feed it to 3D directly — no extra Image.onload round-trip. */

  /* AI generate */
  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || aiGenerating) return
    setAiGenerating(true); setAiError(null); setAiGeneratedUrl(null)
    try {
      const res = await fetch('/api/wrap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      if (!res.ok) throw new Error(`Generate failed: ${res.status}`)
      const { taskId } = await res.json()
      const poll = async () => {
        const r = await fetch(`/api/wrap/by-task?taskId=${taskId}`)
        if (!r.ok) throw new Error(`Poll failed: ${r.status}`)
        const { status, imageUrl } = await r.json()
        if (status === 'completed' && imageUrl) { setAiGeneratedUrl(imageUrl); setAiGenerating(false) }
        else if (status === 'failed') { setAiError('生成失败，请重试'); setAiGenerating(false) }
        else pollTimeoutRef.current = setTimeout(poll, 2000)
      }
      await poll()
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '生成失败，请重试')
      setAiGenerating(false)
    }
  }, [aiPrompt, aiGenerating, setAiGenerating])

  const handleAddAIImageToCanvas = useCallback(() => {
    if (!aiGeneratedUrl) return
    editorRef.current?.addImageFromDataUrl(aiGeneratedUrl)
    setAiGeneratedUrl(null)
  }, [aiGeneratedUrl])

  /* Upload image */
  const handleUploadImageFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 10 * 1024 * 1024) { setUploadError('文件最大 10MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (dataUrl && editorRef.current) editorRef.current.addImageFromDataUrl(dataUrl)
    }
    reader.readAsDataURL(file)
    if (uploadInputRef.current) uploadInputRef.current.value = ''
  }, [])

  /* ───────── Download (clean texture, no bounding boxes) ───────── */
  const handleDownloadTexture = useCallback(() => {
    const url = editorRef.current?.exportTexture?.() ?? null
    if (!url) {
      alert.warning?.('贴图未就绪，请先绘制内容再下载')
      return
    }
    downloadDataUrl(url, `tewan-texture-${selectedModelSlug}-${Date.now()}.png`)
  }, [alert, selectedModelSlug])

  /* ───────── Publish flow (mirrors AI 设计页 publish pipeline) ───────── */
  const handlePublishClick = useCallback(async () => {
    const cleanTexture = editorRef.current?.exportTexture?.() ?? null
    if (!cleanTexture) {
      alert.warning?.('贴图未就绪，请先在画布上完成设计')
      return
    }
    setIsPublishing(true)
    try {
      const uploadDataUrl = await normalizeDiyUploadDataUrl(cleanTexture)
      const res = await fetch('/api/wrap/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelSlug: selectedModelSlug,
          imageBase64: uploadDataUrl,
          prompt: 'Tewan 3D 编辑器作品',
        }),
      })
      if (res.status === 401) {
        alert.warning?.('请先登录后再发布作品')
        const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/tewan-3d-editor'
        router.push(`/login?next=${encodeURIComponent(next)}`)
        return
      }
      const data = (await res.json().catch(() => null)) as { success?: boolean; wrapId?: string; error?: string } | null
      if (!res.ok || !data?.success || !data?.wrapId) {
        throw new Error(data?.error || `保存失败 (HTTP ${res.status})`)
      }
      setActiveWrapId(data.wrapId)
      setPublishTextureUrl(uploadDataUrl)
      setShowPublishModal(true)
    } catch (err) {
      alert.error?.('发布准备失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsPublishing(false)
    }
  }, [alert, router, selectedModelSlug])

  const confirmPublish = useCallback(async (previewImageBase64: string, _options?: MarketplaceOptions) => {
    if (!activeWrapId) {
      alert.warning?.('未找到作品 ID，请重试')
      return
    }
    setIsPublishing(true)
    try {
      const signRes = await fetch('/api/wrap/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wrapId: activeWrapId }),
      })
      const signData = await signRes.json()
      if (!signData.success) throw new Error(`get-upload-url failed: ${signData.error}`)
      const { uploadUrl, ossKey } = signData

      const base64Content = previewImageBase64.replace(/^data:image\/\w+;base64,/, '')
      const byteChars = atob(base64Content)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/png' })

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/png' },
      })
      if (!uploadRes.ok) throw new Error('OSS direct upload failed')

      const confirmRes = await fetch('/api/wrap/confirm-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wrapId: activeWrapId, ossKey }),
      })
      const confirmData = await confirmRes.json()
      if (!confirmData.success) throw new Error(`confirm-publish failed: ${confirmData.error}`)

      alert.success?.('发布成功，作品已进入社区！')
      setShowPublishModal(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('OSS direct upload') || err instanceof TypeError) {
        alert.error?.(`OSS 上传失败 (请检查 CORS 配置): ${message}`)
      } else {
        alert.error?.(`发布失败: ${message}`)
      }
    } finally {
      setIsPublishing(false)
    }
  }, [activeWrapId, alert])

  /* ───────── Left rail tabs ───────── */
  const RAIL_TABS: { id: Exclude<LeftPanel, null>; icon: typeof Droplet; label: string; toolOnOpen?: typeof tool }[] = [
    { id: 'ai',       icon: Sparkles,   label: 'AI' },
    { id: 'base',     icon: Droplet,    label: '底色' },
    { id: 'elements', icon: Smile,      label: '素材' },
    { id: 'draw',     icon: Pencil,     label: '绘图', toolOnOpen: 'paint' },
    { id: 'text',     icon: Type,       label: '文字', toolOnOpen: 'text' },
    { id: 'upload',   icon: ImageUp,    label: '上传' },
    { id: 'layers',   icon: Layers,     label: '图层' },
  ]

  const handleOpenPanel = useCallback((id: Exclude<LeftPanel, null>) => {
    const tab = RAIL_TABS.find((t) => t.id === id)
    if (leftPanel === id) {
      setLeftPanel(null)
    } else {
      setLeftPanel(id)
      if (tab?.toolOnOpen) setTool(tab.toolOnOpen)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftPanel, setLeftPanel, setTool])

  const railBtnCls = (active: boolean) =>
    `group relative flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl transition ${
      active
        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
        : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/5'
    }`

  /* ───────── Context bar (top of canvas) ───────── */
  const renderColorRow = () => (
    <div className="flex items-center gap-1.5">
      <label
        className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-sm ring-1 ring-neutral-300"
        style={{ backgroundColor: color }}
        title="自定义颜色"
      >
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <div className="flex items-center gap-1">
        {PALETTE[0].colors.concat(PALETTE[1].colors.slice(0, 3), PALETTE[2].colors.slice(0, 2)).map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            title={c}
            className={`h-5 w-5 rounded-full ring-1 ring-neutral-300 transition ${
              color === c ? 'scale-110 ring-2 ring-neutral-700' : 'hover:scale-110'
            }`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
    </div>
  )

  const contextBar = useMemo(() => {
    const divider = <div className="h-5 w-px bg-neutral-200" />

    // Whenever something is selected AND the user isn't busy with the brush,
    // promote the selection editor regardless of which tool is active.
    // In particular, this is what makes "click an existing text → change its
    // color" work even when the user is still on the text tool.
    const selectionEditable =
      hasSelection && tool !== 'paint' && tool !== 'erase' && tool !== 'pan'

    if (selectionEditable) {
      const supportsFill =
        activeInfo?.type === 'text' || activeInfo?.type === 'shape' || activeInfo?.type === 'path'
      const currentFill = activeInfo?.fill ?? '#000000'
      const fillLabel = activeInfo?.type === 'text' ? '文字颜色' : '填充颜色'
      return (
        <>
          <span className="text-xs font-medium text-neutral-700">
            {activeInfo?.type === 'text' ? '已选中文字' : '已选中图层'}
          </span>
          {supportsFill && (
            <>
              {divider}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-neutral-500">{fillLabel}</span>
                <label
                  className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-sm ring-1 ring-neutral-300"
                  style={{ backgroundColor: currentFill }}
                  title="自定义颜色"
                >
                  <input
                    type="color"
                    value={currentFill}
                    onChange={(e) => editorRef.current?.setSelectedFill(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
                <div className="flex items-center gap-1">
                  {PALETTE[0].colors.concat(PALETTE[1].colors.slice(0, 3), PALETTE[2].colors.slice(0, 2)).map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      title={c}
                      className={`h-5 w-5 rounded-full ring-1 ring-neutral-300 transition ${
                        currentFill?.toLowerCase() === c.toLowerCase()
                          ? 'scale-110 ring-2 ring-neutral-700'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => editorRef.current?.setSelectedFill(c)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
          {divider}
          <button
            type="button"
            onClick={() => editorRef.current?.bringToFront()}
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-neutral-700 hover:bg-neutral-100"
            title="置顶"
          >
            <ArrowUp className="h-3.5 w-3.5" /> 置顶
          </button>
          <button
            type="button"
            onClick={() => editorRef.current?.sendToBack()}
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-neutral-700 hover:bg-neutral-100"
            title="置底"
          >
            <ArrowDown className="h-3.5 w-3.5" /> 置底
          </button>
          {divider}
          <button
            type="button"
            onClick={() => editorRef.current?.deleteSelected()}
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-red-600 hover:bg-red-50"
            title="删除（Delete）"
          >
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </button>
        </>
      )
    }

    if (tool === 'select') {
      return (
        <span className="text-xs text-neutral-500">
          选择工具：点击画布中的图层进行操作（快捷键 V）。按住 Alt 拖动可复制元素。
        </span>
      )
    }

    if (tool === 'paint' || tool === 'erase') {
      const isErase = tool === 'erase'
      return (
        <>
          <span className="text-xs font-medium text-neutral-700">{isErase ? '橡皮擦' : '画笔'}</span>
          {divider}
          {!isErase && renderColorRow()}
          {!isErase && divider}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">粗细</span>
            <input
              type="range"
              min={2}
              max={80}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-28 accent-neutral-700"
            />
            <span className="min-w-[32px] text-xs font-medium text-neutral-700">{brushSize}px</span>
          </div>
          {!isErase && (
            <>
              {divider}
              <button
                type="button"
                onClick={() => editorRef.current?.fillAll(color)}
                className="flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs text-neutral-700 hover:bg-neutral-50"
                title="填充整个画布为当前颜色"
              >
                <PaintBucket className="h-3.5 w-3.5" /> 一键填色
              </button>
            </>
          )}
        </>
      )
    }

    if (tool === 'shape') {
      return (
        <>
          <span className="text-xs font-medium text-neutral-700">形状</span>
          {divider}
          {renderColorRow()}
          {divider}
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'rect',   Icon: Square,     label: '矩形' },
                { id: 'circle', Icon: CircleIcon, label: '圆形' },
                { id: 'line',   Icon: Minus,      label: '线条' },
              ] as const
            ).map(({ id, Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setShapeType(id)
                  editorRef.current?.addShape(id, color)
                }}
                className={`flex h-8 items-center gap-1 rounded-lg px-2 text-xs transition ${
                  shapeType === id
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
                title={label}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </>
      )
    }

    if (tool === 'text') {
      return (
        <>
          <span className="text-xs font-medium text-neutral-700">文字</span>
          {divider}
          {renderColorRow()}
          {divider}
          <select
            className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-xs text-neutral-700 focus:border-neutral-700 focus:outline-none"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFontSize(Math.max(12, fontSize - 8))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            >
              −
            </button>
            <span className="min-w-[32px] text-center text-xs font-medium text-neutral-700">{fontSize}</span>
            <button
              type="button"
              onClick={() => setFontSize(Math.min(256, fontSize + 8))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => editorRef.current?.addText('TESLA', fontSize, fontFamily, color)}
            className="flex h-8 items-center gap-1 rounded-lg bg-neutral-900 px-3 text-xs font-medium text-white hover:bg-black"
          >
            <Type className="h-3.5 w-3.5" /> 添加文字
          </button>
        </>
      )
    }

    if (tool === 'sticker') {
      return (
        <>
          <span className="text-xs font-medium text-neutral-700">贴纸</span>
          {divider}
          <span className="text-xs text-neutral-500">在左侧「素材」面板点击贴纸添加到画布</span>
        </>
      )
    }

    return null
  }, [tool, hasSelection, activeInfo, color, brushSize, shapeType, fontSize, fontFamily, setShapeType, setColor, setBrushSize, setFontSize, setFontFamily])

  /* ───────── Left panel content ───────── */
  const panelTitleBar = (title: string) => (
    <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      <button
        type="button"
        onClick={() => setLeftPanel(null)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        title="收起面板"
      >
        <PanelLeftClose className="h-4 w-4" />
      </button>
    </div>
  )

  /** Sorted view of stops by offset — used for both rendering the CSS preview
   *  and serialising into the fabric gradient. We never mutate `gradientStops`
   *  in place; sorting here keeps the underlying array order stable while
   *  giving the preview a left→right ordering. */
  const sortedStops = useMemo(
    () => [...gradientStops].sort((a, b) => a.offset - b.offset),
    [gradientStops],
  )
  const cssGradient = useMemo(
    () =>
      `linear-gradient(${gradientAngle}deg, ${sortedStops
        .map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`)
        .join(', ')})`,
    [gradientAngle, sortedStops],
  )

  /** Linear interpolation between two CSS hex colors at `t∈[0,1]`. Used to
   *  pick a sensible color when the user inserts a new stop between two
   *  existing ones, so the preview doesn't visually "jump". */
  const lerpHex = (a: string, b: string, t: number): string => {
    const parse = (h: string) => {
      const v = h.replace('#', '')
      const n = v.length === 3 ? v.split('').map((c) => c + c).join('') : v
      return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
    }
    const [r1, g1, b1] = parse(a)
    const [r2, g2, b2] = parse(b)
    const r = Math.round(r1 + (r2 - r1) * t)
    const g = Math.round(g1 + (g2 - g1) * t)
    const bl = Math.round(b1 + (b2 - b1) * t)
    return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`
  }

  /** Insert a stop at `offset` with a color sampled from the current
   *  gradient at that position, then auto-select it for editing. */
  const addGradientStop = useCallback((offset: number) => {
    setGradientStops((prev) => {
      const sorted = [...prev].sort((a, b) => a.offset - b.offset)
      let color = sorted[sorted.length - 1].color
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i], b = sorted[i + 1]
        if (offset >= a.offset && offset <= b.offset) {
          const t = b.offset === a.offset ? 0 : (offset - a.offset) / (b.offset - a.offset)
          color = lerpHex(a.color, b.color, t)
          break
        }
      }
      const id = makeStopId()
      setActiveStopId(id)
      return [...prev, { id, color, offset: Math.max(0, Math.min(1, offset)) }]
    })
  }, [])

  const removeGradientStop = useCallback((id: string) => {
    setGradientStops((prev) => {
      if (prev.length <= 2) return prev
      const next = prev.filter((s) => s.id !== id)
      if (id === activeStopId) setActiveStopId(next[0].id)
      return next
    })
  }, [activeStopId])

  const updateStopColor = useCallback((id: string, color: string) => {
    setGradientStops((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)))
  }, [])
  const updateStopOffset = useCallback((id: string, offset: number) => {
    const clamped = Math.max(0, Math.min(1, offset))
    setGradientStops((prev) => prev.map((s) => (s.id === id ? { ...s, offset: clamped } : s)))
  }, [])

  /** Drag a stop horizontally along the gradient bar.
   *  We attach window-level listeners on pointer-down so the drag continues
   *  smoothly even if the cursor leaves the bar's bounding rect. */
  const stopBarRef = useRef<HTMLDivElement | null>(null)
  const draggingStopRef = useRef<string | null>(null)
  const onStopPointerDown = useCallback((id: string, ev: React.PointerEvent) => {
    ev.preventDefault()
    setActiveStopId(id)
    draggingStopRef.current = id
    const bar = stopBarRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const move = (e: PointerEvent) => {
      const x = e.clientX - rect.left
      const offset = Math.max(0, Math.min(1, x / Math.max(1, rect.width)))
      const dragId = draggingStopRef.current
      if (dragId) updateStopOffset(dragId, offset)
    }
    const up = () => {
      draggingStopRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [updateStopOffset])

  /** Click on empty area of the bar adds a stop at that offset. */
  const onBarClick = useCallback((ev: React.MouseEvent) => {
    if (draggingStopRef.current) return
    const bar = stopBarRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const offset = Math.max(0, Math.min(1, x / Math.max(1, rect.width)))
    addGradientStop(offset)
  }, [addGradientStop])

  const activeStop = useMemo(
    () => gradientStops.find((s) => s.id === activeStopId) ?? gradientStops[0],
    [gradientStops, activeStopId],
  )

  const applyGradientFill = useCallback(() => {
    const fill: GradientFill = {
      angle: gradientAngle,
      stops: sortedStops.map((s) => ({ offset: s.offset, color: s.color })),
    }
    editorRef.current?.fillGradient(fill)
  }, [gradientAngle, sortedStops])

  const GRADIENT_PRESETS: { id: string; name: string; stops: GradStop[]; angle: number }[] = [
    { id: 'sunset',    name: '日落',   angle: 135, stops: [{ id: 'p1', color: '#ff7e5f', offset: 0 }, { id: 'p2', color: '#feb47b', offset: 1 }] },
    { id: 'ocean',     name: '海洋',   angle: 180, stops: [{ id: 'p1', color: '#2193b0', offset: 0 }, { id: 'p2', color: '#6dd5ed', offset: 1 }] },
    { id: 'cosmic',    name: '极光',   angle: 135, stops: [{ id: 'p1', color: '#7e3ff2', offset: 0 }, { id: 'p2', color: '#3b82f6', offset: 0.5 }, { id: 'p3', color: '#ec4899', offset: 1 }] },
    { id: 'matte',     name: '哑光黑', angle: 180, stops: [{ id: 'p1', color: '#1f2937', offset: 0 }, { id: 'p2', color: '#000000', offset: 1 }] },
    { id: 'gold',      name: '黄金',   angle: 90,  stops: [{ id: 'p1', color: '#f6d365', offset: 0 }, { id: 'p2', color: '#fda085', offset: 1 }] },
    { id: 'forest',    name: '森林',   angle: 180, stops: [{ id: 'p1', color: '#0f766e', offset: 0 }, { id: 'p2', color: '#22c55e', offset: 1 }] },
    { id: 'cyberpunk', name: '霓虹',   angle: 90,  stops: [{ id: 'p1', color: '#06b6d4', offset: 0 }, { id: 'p2', color: '#a855f7', offset: 0.5 }, { id: 'p3', color: '#ec4899', offset: 1 }] },
    { id: 'fire',      name: '烈焰',   angle: 0,   stops: [{ id: 'p1', color: '#7c2d12', offset: 0 }, { id: 'p2', color: '#dc2626', offset: 0.5 }, { id: 'p3', color: '#fbbf24', offset: 1 }] },
  ]

  const applyPreset = useCallback((preset: typeof GRADIENT_PRESETS[number]) => {
    const seeded = preset.stops.map((s) => ({ ...s, id: makeStopId() }))
    setGradientStops(seeded)
    setGradientAngle(preset.angle)
    setActiveStopId(seeded[0].id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const basePanel = (
    <>
      {panelTitleBar('底色')}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* 一键填色（纯色） */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">一键填色</p>
            <label
              className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-sm ring-1 ring-neutral-300"
              style={{ backgroundColor: color }}
              title="自定义颜色"
            >
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          <div className="space-y-2">
            {PALETTE.map((group) => (
              <div key={group.label}>
                <p className="mb-1 text-[10px] text-neutral-400">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={c}
                      className={`h-7 w-7 rounded-full ring-1 ring-neutral-300 transition ${
                        color === c ? 'scale-110 ring-2 ring-neutral-700' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => editorRef.current?.fillAll(color)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black"
          >
            <PaintBucket className="h-3.5 w-3.5" /> 用当前颜色填满车身
          </button>
        </div>

        {/* 渐变填色（多色节点） */}
        <div className="border-t border-neutral-100 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">渐变填色</p>
            <button
              type="button"
              onClick={() => addGradientStop(0.5)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-100"
              title="添加颜色节点"
            >
              <Plus className="h-3 w-3" /> 节点
            </button>
          </div>

          <div
            className="mb-3 h-16 w-full rounded-xl border border-neutral-200 shadow-inner"
            style={{ background: cssGradient }}
          />

          {/* 节点编辑条：横轴 0%→100%，可拖动每个节点；空白处单击新增 */}
          <div className="mb-3">
            <div
              ref={stopBarRef}
              onClick={onBarClick}
              className="relative h-7 w-full cursor-copy rounded-md border border-neutral-200"
              style={{ background: `linear-gradient(90deg, ${sortedStops.map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`).join(', ')})` }}
              title="单击添加节点 · 拖动节点改变位置"
            >
              {sortedStops.map((s) => {
                const isActive = s.id === activeStopId
                return (
                  <button
                    key={s.id}
                    type="button"
                    onPointerDown={(e) => onStopPointerDown(s.id, e)}
                    onClick={(e) => { e.stopPropagation(); setActiveStopId(s.id) }}
                    className={`absolute top-1/2 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 shadow-md transition ${
                      isActive ? 'border-neutral-900 ring-2 ring-neutral-300' : 'border-white hover:scale-110'
                    }`}
                    style={{ left: `${s.offset * 100}%`, backgroundColor: s.color }}
                    title={`${s.color} · ${(s.offset * 100).toFixed(0)}%`}
                  />
                )
              })}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* 当前选中节点的属性 */}
          {activeStop && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
              <label
                className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-neutral-300"
                style={{ backgroundColor: activeStop.color }}
                title="自定义颜色"
              >
                <input
                  type="color"
                  value={activeStop.color}
                  onChange={(e) => updateStopColor(activeStop.id, e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between text-[10px] text-neutral-500">
                  <span>当前节点</span>
                  <span className="font-mono text-neutral-700">{(activeStop.offset * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(activeStop.offset * 100)}
                  onChange={(e) => updateStopOffset(activeStop.id, Number(e.target.value) / 100)}
                  className="w-full accent-neutral-700"
                />
              </div>
              <button
                type="button"
                onClick={() => removeGradientStop(activeStop.id)}
                disabled={gradientStops.length <= 2}
                className="grid h-7 w-7 place-items-center rounded-md text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                title={gradientStops.length <= 2 ? '至少保留 2 个节点' : '删除节点'}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* 角度 */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[10px] text-neutral-500">
              <span>方向角度</span>
              <span className="font-medium text-neutral-700">{gradientAngle}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={gradientAngle}
              onChange={(e) => setGradientAngle(Number(e.target.value))}
              className="w-full accent-neutral-700"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setGradientAngle(a)}
                  className={`rounded-md px-1.5 py-0.5 text-[10px] transition ${
                    gradientAngle === a
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {a}°
                </button>
              ))}
            </div>
          </div>

          {/* 预设 */}
          <div className="mb-3">
            <p className="mb-1.5 text-[10px] text-neutral-400">渐变预设</p>
            <div className="grid grid-cols-4 gap-1.5">
              {GRADIENT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="group flex flex-col items-center gap-1"
                  title={p.name}
                >
                  <div
                    className="h-9 w-full rounded-md ring-1 ring-neutral-200 transition group-hover:ring-2 group-hover:ring-neutral-700"
                    style={{
                      background: `linear-gradient(${p.angle}deg, ${p.stops
                        .map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`)
                        .join(', ')})`,
                    }}
                  />
                  <span className="text-[10px] text-neutral-500">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={applyGradientFill}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-black"
          >
            <PaintBucket className="h-3.5 w-3.5" /> 应用渐变到车身
          </button>
          <p className="mt-2 text-center text-[10px] text-neutral-400">
            单击渐变条空白处可新增节点 · 拖动节点圆点可调整位置
          </p>
        </div>
      </div>
    </>
  )

  const aiPanel = (
    <>
      {panelTitleBar('AI 生成')}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">快速风格</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setAiPrompt(s.prompt)}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left text-xs transition ${
                  aiPrompt === s.prompt
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <span className="text-lg leading-none">{s.icon}</span>
                <span className="font-medium">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">描述你的想法</p>
          <div className="relative">
            <textarea
              rows={4}
              maxLength={200}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="描述你想要的车身风格，例如：金属光泽的紫色渐变，带有闪电图案…"
              className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:border-neutral-700 focus:outline-none"
            />
            <span className="absolute bottom-2 right-3 text-[10px] text-neutral-400">{aiPrompt.length}/200</span>
          </div>
        </div>

        {aiError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {aiError}
          </div>
        )}

        {aiGeneratedUrl && !aiGenerating && (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={aiGeneratedUrl} alt="AI 生成结果" className="w-full object-cover" />
            <div className="flex gap-2 p-2">
              <button
                type="button"
                onClick={handleAddAIImageToCanvas}
                className="flex-1 rounded-lg bg-neutral-900 py-2 text-xs font-medium text-white hover:bg-black"
              >
                添加到画布
              </button>
              <button
                type="button"
                onClick={() => setAiGeneratedUrl(null)}
                className="flex-1 rounded-lg border border-neutral-200 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
              >
                重新生成
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!aiPrompt.trim() || aiGenerating}
          onClick={handleAIGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {aiGenerating ? (
            <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> 生成中…</>
          ) : (
            <><Wand2 className="h-4 w-4" /> AI 生成</>
          )}
        </button>

        <p className="text-center text-[11px] text-neutral-400">AI 生成的纹理会作为图片图层添加到画布</p>
      </div>
    </>
  )

  const elementsPanel = (
    <>
      {panelTitleBar('素材库')}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">形状</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'rect',   Icon: Square,     label: '矩形' },
                { id: 'circle', Icon: CircleIcon, label: '圆形' },
                { id: 'line',   Icon: Minus,      label: '线条' },
              ] as const
            ).map(({ id, Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setShapeType(id); editorRef.current?.addShape(id, color) }}
                className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white py-3 text-xs text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900"
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">贴纸</p>
          <div className="grid grid-cols-6 gap-1.5">
            {STICKERS.map((emoji, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setTool('sticker'); editorRef.current?.addSticker(emoji) }}
                className="flex h-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-xl transition hover:border-neutral-400 hover:bg-neutral-50"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )

  const uploadPanel = (
    <>
      {panelTitleBar('上传')}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 text-center transition hover:border-neutral-400 hover:bg-neutral-50"
        >
          <ImageUp className="h-8 w-8 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-700">点击上传图片</p>
          <p className="text-xs text-neutral-500">支持 JPG / PNG / WebP / SVG，最大 10MB</p>
        </button>
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadImageFile}
        />
        {uploadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{uploadError}</div>
        )}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-500">
          上传后图片以独立图层添加到画布，可自由移动、缩放、旋转；结合画笔工具可二次创作。
        </div>
      </div>
    </>
  )

  const textPanel = (
    <>
      {panelTitleBar('文字')}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">预设样式</p>
          <div className="space-y-2">
            {TEXT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setFontSize(p.fontSize)
                  setFontFamily(p.fontFamily)
                  editorRef.current?.addText(p.preview, p.fontSize, p.fontFamily, color)
                }}
                className="group flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-left transition hover:border-neutral-400 hover:bg-neutral-50"
              >
                <span
                  className="truncate text-neutral-900 group-hover:text-neutral-900"
                  style={{ fontFamily: p.fontFamily, fontSize: Math.min(p.fontSize / 3.5, 28), fontWeight: 700 }}
                >
                  {p.preview}
                </span>
                <span className="text-[10px] text-neutral-400">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">字体</p>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-800 focus:border-neutral-700 focus:outline-none"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">字号</p>
          <input
            type="range"
            min={12}
            max={256}
            step={4}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full accent-neutral-700"
          />
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
            <span>12</span><span className="text-neutral-900 font-medium">{fontSize}</span><span>256</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => editorRef.current?.addText('TESLA', fontSize, fontFamily, color)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-black"
        >
          <Type className="h-4 w-4" /> 添加自定义文字
        </button>
      </div>
    </>
  )

  const drawPanel = (
    <>
      {panelTitleBar('绘图工具')}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">工具</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTool('paint')}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition ${
                tool === 'paint'
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <Pencil className="h-4 w-4" /> 画笔
            </button>
            <button
              type="button"
              onClick={() => setTool('erase')}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition ${
                tool === 'erase'
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <Eraser className="h-4 w-4" /> 橡皮
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">粗细</p>
          <input
            type="range"
            min={2}
            max={80}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-full accent-neutral-700"
          />
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
            <span>细</span>
            <span className="text-neutral-900 font-medium">{brushSize}px</span>
            <span>粗</span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">颜色</p>
            <label
              className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-sm ring-1 ring-neutral-300"
              style={{ backgroundColor: color }}
              title="自定义颜色"
            >
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
          <div className="space-y-2">
            {PALETTE.map((group) => (
              <div key={group.label}>
                <p className="mb-1 text-[10px] text-neutral-400">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full ring-1 ring-neutral-300 transition ${
                        color === c ? 'scale-110 ring-2 ring-neutral-700' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => editorRef.current?.fillAll(color)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <PaintBucket className="h-4 w-4" /> 一键填满车身
        </button>
      </div>
    </>
  )

  const layersPanel = (
    <>
      {panelTitleBar('图层')}
      <div className="flex-1 overflow-y-auto p-2">
        {layers.length === 0 ? (
          <p className="p-4 text-center text-xs text-neutral-400">暂无图层，从左侧添加元素开始创作</p>
        ) : (
          <ul className="space-y-1">
            {layers.map((l) => {
              const isDragging = dragLayerId === l.id
              const showBefore = dragOver?.id === l.id && dragOver.position === 'before'
              const showAfter = dragOver?.id === l.id && dragOver.position === 'after'
              return (
                <li key={l.id} className="relative">
                  {showBefore && (
                    <div className="pointer-events-none absolute -top-0.5 left-2 right-2 h-0.5 rounded bg-neutral-900" />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDragLayerId(l.id)
                      e.dataTransfer.effectAllowed = 'move'
                      try { e.dataTransfer.setData('text/plain', l.id) } catch { /* ignore */ }
                    }}
                    onDragOver={(e) => {
                      if (!dragLayerId || dragLayerId === l.id) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      const rect = e.currentTarget.getBoundingClientRect()
                      const position: 'before' | 'after' =
                        e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                      setDragOver((prev) =>
                        prev?.id === l.id && prev.position === position ? prev : { id: l.id, position }
                      )
                    }}
                    onDragLeave={(e) => {
                      // Only clear when leaving the row itself, not a child.
                      if (e.currentTarget === e.target) {
                        setDragOver((prev) => (prev?.id === l.id ? null : prev))
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const fromId = dragLayerId
                      const dest = dragOver
                      setDragLayerId(null)
                      setDragOver(null)
                      if (fromId && dest && fromId !== dest.id) {
                        editorRef.current?.reorderLayer(fromId, dest.id, dest.position)
                      }
                    }}
                    onDragEnd={() => { setDragLayerId(null); setDragOver(null) }}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs transition ${
                      l.active
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-700 hover:bg-neutral-50'
                    } ${isDragging ? 'opacity-40' : ''}`}
                    onClick={() => editorRef.current?.selectLayer(l.id)}
                  >
                    <span
                      className={`flex h-5 w-4 shrink-0 cursor-grab items-center justify-center ${
                        l.active ? 'text-white/70' : 'text-neutral-400'
                      } active:cursor-grabbing`}
                      title="拖动调整图层顺序"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[10px] ${
                        l.active
                          ? 'border-white/20 bg-white/10 text-white'
                          : 'border-neutral-200 bg-white text-neutral-600'
                      }`}
                    >
                      {l.type === 'image' ? '图' : l.type === 'text' ? 'T' : l.type === 'shape' ? '◼' : '~'}
                    </span>
                    <span className="flex-1 truncate">{l.name}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); editorRef.current?.toggleLayerVisibility(l.id) }}
                      className={`flex h-6 w-6 items-center justify-center rounded ${
                        l.active ? 'text-white/70 hover:text-white' : 'text-neutral-400 hover:text-neutral-700'
                      }`}
                      title={l.visible ? '隐藏图层' : '显示图层'}
                    >
                      {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); editorRef.current?.removeLayer(l.id) }}
                      className={`flex h-6 w-6 items-center justify-center rounded opacity-0 transition group-hover:opacity-100 ${
                        l.active ? 'text-white/70 hover:text-white' : 'text-neutral-400 hover:text-red-600'
                      }`}
                      title="删除图层"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {showAfter && (
                    <div className="pointer-events-none absolute -bottom-0.5 left-2 right-2 h-0.5 rounded bg-neutral-900" />
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 px-2 text-[10px] leading-relaxed text-neutral-400">
          列表顶部为最上层。拖动图层条目可上下移动调整层级顺序。
        </p>
      </div>
    </>
  )

  const activePanelNode = (() => {
    switch (leftPanel) {
      case 'base':     return basePanel
      case 'ai':       return aiPanel
      case 'elements': return elementsPanel
      case 'upload':   return uploadPanel
      case 'text':     return textPanel
      case 'draw':     return drawPanel
      case 'layers':   return layersPanel
      default:         return null
    }
  })()

  /* ───────── 3D preview controls (used in floating panel & mobile) ───────── */
  const previewControls = (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setLightingMode(lightingMode === 'day' ? 'garage' : 'day')}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-700 hover:bg-neutral-50"
        >
          {lightingMode === 'garage' ? <><Sun className="h-3.5 w-3.5" /> 浅色</> : <><Moon className="h-3.5 w-3.5" /> 深色</>}
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white text-xs text-neutral-700 hover:bg-neutral-50"
        >
          {autoRotate ? <><Pause className="h-3.5 w-3.5" /> 暂停</> : <><RotateCw className="h-3.5 w-3.5" /> 旋转</>}
        </button>
      </div>
    </div>
  )

  const zoomPercent = Math.round(zoom * 100)

  return (
    <div className="relative flex h-screen min-h-[640px] w-full flex-col overflow-hidden bg-neutral-100 text-neutral-900">

      {/* ════════ Top Bar ════════ */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-neutral-100"
          title="返回首页"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#E31937] text-sm font-bold text-white shadow-[0_8px_16px_rgba(227,25,55,0.25)] ring-1 ring-black/10">T</span>
          <h1 className="text-sm font-semibold text-neutral-900">特玩高级编辑器</h1>
        </Link>

        <div className="h-5 w-px bg-neutral-200" />

        <div className="relative">
          <select
            className="h-9 appearance-none rounded-xl border border-neutral-200 bg-white pl-3 pr-8 text-sm text-neutral-800 focus:border-neutral-700 focus:outline-none"
            value={selectedModelSlug}
            onChange={(e) => setSelectedModelSlug(e.target.value)}
          >
            {MODELS.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        </div>

        {selectedModel?.uv_mask_url && (
          <>
            <div className="h-5 w-px bg-neutral-200" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUVMask((v) => !v)}
                className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition ${
                  showUVMask
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'
                }`}
                title="UV 贴膜模板参考线"
              >
                <Layers className="h-3.5 w-3.5" /> UV
              </button>
              {showUVMask && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-500">遮罩透明度</span>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={uvMaskOpacity}
                    onChange={(e) => setUVMaskOpacity(Number(e.target.value))}
                    className="w-24 accent-neutral-700"
                  />
                  <span className="min-w-[34px] text-right text-[11px] font-medium tabular-nums text-neutral-700">
                    {Math.round(uvMaskOpacity * 100)}%
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-0.5">
          <button
            type="button"
            onClick={() => editorRef.current?.undo()}
            disabled={!history.canUndo}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            title="撤销 (⌘Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editorRef.current?.redo()}
            disabled={!history.canRedo}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            title="重做 (⌘⇧Z)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setPanel3DVisible(!panel3DVisible)}
          className={`hidden h-9 items-center gap-1.5 rounded-xl border px-3 text-xs transition md:flex ${
            panel3DVisible
              ? 'border-neutral-900 bg-neutral-900 text-white'
              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
          title="显示 / 隐藏 3D 预览"
        >
          <Box className="h-4 w-4" /> 3D 预览
        </button>

        <button
          type="button"
          onClick={handlePublishClick}
          disabled={!textureDataUrl || isPublishing}
          className="hidden h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 md:flex"
          title="发布到社区"
        >
          <Send className="h-4 w-4" /> {isPublishing ? '发布中…' : '发布'}
        </button>

        <button
          type="button"
          onClick={handleDownloadTexture}
          disabled={!textureDataUrl}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-neutral-900 px-4 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
          title="下载贴图（PNG）"
        >
          <Download className="h-4 w-4" /> 下载
        </button>
      </header>

      {/* ════════ Body: rail + panel + workspace ════════ */}
      <div className="flex min-h-0 flex-1">

        {/* Left rail */}
        <nav className="z-10 flex w-20 shrink-0 flex-col items-center gap-1 border-r border-neutral-200 bg-white px-2 py-3">
          {/* Always-on tool buttons (selection / pan) */}
          <button
            type="button"
            onClick={() => setTool('select')}
            className={railBtnCls(tool === 'select')}
            title="选择 (V)"
          >
            <MousePointer2 className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">选择</span>
          </button>
          <button
            type="button"
            onClick={() => setTool('pan')}
            className={railBtnCls(tool === 'pan')}
            title="抓手 (H) — 拖动画布"
          >
            <Hand className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">抓手</span>
          </button>

          <div className="my-1 h-px w-8 bg-neutral-200" />

          {RAIL_TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleOpenPanel(id)}
              className={railBtnCls(leftPanel === id)}
              title={label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          ))}
        </nav>

        {/* Expanded left panel */}
        {activePanelNode && (
          <aside className="z-10 flex w-80 shrink-0 flex-col border-r border-neutral-200 bg-white">
            {activePanelNode}
          </aside>
        )}

        {/* Canvas workspace */}
        <section className="relative flex min-w-0 flex-1 flex-col">

          {/* Context bar */}
          <div className="z-10 flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4">
            {contextBar}
          </div>

          {/* Canvas */}
          <div className="relative min-h-0 flex-1">
            <Canvas2DEditor
              ref={editorRef}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              onSelectionChange={setHasSelection}
              onActiveObjectChange={setActiveInfo}
              onHistoryChange={setHistory}
              onZoomChange={setZoom}
              onLayersChange={setLayers}
              uvMaskUrl={showUVMask ? selectedModel?.uv_mask_url : undefined}
              uvMaskNativeWidth={selectedModel?.uv_mask_native_width}
              uvMaskNativeHeight={selectedModel?.uv_mask_native_height}
              uvMaskOpacity={uvMaskOpacity}
              textureRotation={selectedModel?.uv_texture_rotation}
              workspaceBackground="#f3f4f6"
              onRotationChange={setCanvasRotation}
            />
          </div>

          {/* Bottom zoom bar */}
          <div className="z-10 flex h-10 shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-white px-4 text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <span>{selectedModel?.name ?? ''}</span>
              <span className="text-neutral-300">·</span>
              <span>{canvasWidth} × {canvasHeight}</span>
              <span className="text-neutral-300">·</span>
              <span>快捷键：V 选择 / B 画笔 / E 橡皮 / T 文字 / R 形状 / ⌘+滚轮 缩放 / 空格 拖动</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => editorRef.current?.rotateCCW()}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
                title="逆时针旋转视图 90°"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => editorRef.current?.rotateCW()}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
                title="顺时针旋转视图 90°"
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <span className="min-w-[36px] text-center text-xs font-medium text-neutral-700">{canvasRotation}°</span>
              <div className="mx-1 h-4 w-px bg-neutral-200" />
              <button
                type="button"
                onClick={() => editorRef.current?.zoomOut()}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
                title="缩小 (⌘-)"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[44px] text-center text-xs font-medium text-neutral-700">{zoomPercent}%</span>
              <button
                type="button"
                onClick={() => editorRef.current?.zoomIn()}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
                title="放大 (⌘+)"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => editorRef.current?.fitToScreen()}
                className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-neutral-600 hover:bg-neutral-100"
                title="适配画布 (⌘0)"
              >
                <Maximize2 className="h-3.5 w-3.5" /> 适配
              </button>
              <button
                type="button"
                onClick={() => editorRef.current?.resetZoom()}
                className="flex h-7 items-center rounded-md px-2 text-xs text-neutral-600 hover:bg-neutral-100"
                title="100%"
              >
                100%
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ════════ Desktop: floating draggable 3D panel ════════ */}
      {panel3DVisible && (
        <div className="hidden md:block">
          <DraggablePanel3D
            defaultSize={{ width: 360, height: 320 }}
            minSize={{ width: 260, height: 220 }}
            title="3D 实时预览"
            allowFullscreen
            onClose={() => setPanel3DVisible(false)}
          >
            <div className="flex h-full flex-col">
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <CarPreview3D
                  modelUrl={selectedModel.model_3d_url}
                  wheelUrl={selectedModel.wheel_url}
                  modelSlug={selectedModel.slug}
                  textureDataUrl={textureDataUrl}
                  lightingMode={lightingMode}
                  autoRotate={autoRotate}
                />
              </div>
              <div className="shrink-0 border-t border-neutral-200">
                {previewControls}
              </div>
            </div>
          </DraggablePanel3D>
        </div>
      )}

      {/* ════════ Mobile FAB ════════ */}
      <button
        type="button"
        aria-label="打开 3D 预览"
        className="fixed bottom-6 right-4 z-[100] flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:scale-105 active:scale-95 md:hidden"
        onClick={() => setMobile3dOpen(true)}
      >
        <Box className="h-5 w-5" aria-hidden />
      </button>

      {/* ════════ Mobile 3D Modal ════════ */}
      {mobile3dOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-950/90 p-4 md:hidden" role="dialog" aria-modal="true">
          <div className="relative flex h-full max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">3D 预览</h2>
              <button
                type="button"
                onClick={() => setMobile3dOpen(false)}
                aria-label="关闭"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              <CarPreview3D
                modelUrl={selectedModel.model_3d_url}
                wheelUrl={selectedModel.wheel_url}
                modelSlug={selectedModel.slug}
                textureDataUrl={textureDataUrl}
                lightingMode={lightingMode}
                autoRotate={autoRotate}
              />
            </div>
            <div className="shrink-0 border-t border-neutral-200">{previewControls}</div>
          </div>
        </div>
      )}

      {/* ════════ Publish Modal ════════ */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={confirmPublish}
        modelSlug={selectedModel.slug}
        modelUrl={resolveModelAssetUrl(selectedModel.model_3d_url)}
        wheelUrl={selectedModel.wheel_url ? resolveModelAssetUrl(selectedModel.wheel_url) : undefined}
        textureUrl={publishTextureUrl || textureDataUrl || ''}
        isPublishing={isPublishing}
      />
    </div>
  )
}
