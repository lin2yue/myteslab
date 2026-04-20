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
  Undo2, Redo2, Download, Box, Share2, ChevronDown,
  // Left rail
  LayoutGrid, Sparkles, Smile, ImageUp, Type, Pencil, Layers,
  PanelLeftClose,
  // Context bar / elements
  Eraser, Square, Circle as CircleIcon,
  Minus, PaintBucket, Trash2,
  ArrowUp, ArrowDown, Eye, EyeOff,
  // Zoom / 3D controls
  ZoomIn, ZoomOut, Maximize2, Moon, Sun, RotateCw, Pause,
  X, Wand2,
} from 'lucide-react'
import { Canvas2DEditor, Canvas2DEditorRef, EditorProjectData, LayerSummary } from './Canvas2DEditor'
import { CarPreview3D } from './CarPreview3D'
import { DraggablePanel3D } from './DraggablePanel3D'
import { useEditorStore, type LeftPanel } from '../store/useEditorStore'
import { DEFAULT_MODELS, type ModelConfig } from '@/config/models'

/* ───────── constants ───────── */
const DRAFT_TEXTURE_KEY = 'tewan-3d-editor:draft:texture'
const PROJECT_STORAGE_KEY = 'tewan-3d-editor:project:v1'

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

type ProjectEnvelope = {
  modelSlug: string
  savedAt: string
  textureDataUrl: string | null
  textureOssUrl?: string | null
  project: EditorProjectData
}

/* ───────── helpers ───────── */
function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}
function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Tewan3DEditorApp — Canva 风格贴膜工作台
 * ═══════════════════════════════════════════════════════════════════════ */
export function Tewan3DEditorApp({ models: propModels }: { models?: ModelConfig[] } = {}) {
  const MODELS = propModels && propModels.length > 0 ? propModels : DEFAULT_MODELS

  /* Store */
  const textureDataUrl = useEditorStore((s) => s.textureDataUrl)
  const setTextureDataUrl = useEditorStore((s) => s.setTextureDataUrl)
  const materialFinish = useEditorStore((s) => s.materialFinish)
  const setMaterialFinish = useEditorStore((s) => s.setMaterialFinish)
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
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedModelSlug, setSelectedModelSlug] = useState(MODELS[0]?.slug ?? '')
  const [hasSelection, setHasSelection] = useState(false)
  const [history, setHistory] = useState({ canUndo: false, canRedo: false })
  const [zoom, setZoom] = useState(1)
  const [layers, setLayers] = useState<LayerSummary[]>([])
  const [showUVMask, setShowUVMask] = useState(true)
  const [uvMaskOpacity, setUVMaskOpacity] = useState(0.3)
  const [mobile3dOpen, setMobile3dOpen] = useState(false)
  const [ossTextureUrl, setOssTextureUrl] = useState<string | null>(null)
  const [uploadingTexture, setUploadingTexture] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGeneratedUrl, setAiGeneratedUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const selectedModel = useMemo(
    () => MODELS.find((m) => m.slug === selectedModelSlug) ?? MODELS[0],
    [selectedModelSlug, MODELS]
  )

  /** `textureDataUrl` is already rotated inside Canvas2DEditor's `syncTexture`,
   *  so we can feed it to 3D directly — no extra Image.onload round-trip. */

  /* Project save / load helpers */
  const buildProjectEnvelope = (): ProjectEnvelope | null => {
    const project = editorRef.current?.exportProject()
    if (!project) return null
    return {
      modelSlug: selectedModelSlug,
      savedAt: new Date().toISOString(),
      textureDataUrl,
      textureOssUrl: ossTextureUrl,
      project,
    }
  }
  const hydrateProject = async (envelope: ProjectEnvelope) => {
    if (envelope.modelSlug) setSelectedModelSlug(envelope.modelSlug)
    if (envelope.project && editorRef.current) await editorRef.current.importProject(envelope.project)
    if (envelope.textureOssUrl) setOssTextureUrl(envelope.textureOssUrl)
  }

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

  /* Import project */
  const handleImportProjectFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const envelope = JSON.parse(ev.target?.result as string) as ProjectEnvelope
        await hydrateProject(envelope)
      } catch { /* ignore */ }
    }
    reader.readAsText(file)
    if (importInputRef.current) importInputRef.current.value = ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Upload texture to OSS */
  const handleUploadTextureToOSS = useCallback(async () => {
    if (!textureDataUrl || uploadingTexture) return
    setUploadingTexture(true)
    try {
      const blob = await dataUrlToBlob(textureDataUrl)
      const fd = new FormData(); fd.append('file', blob, `texture-${Date.now()}.png`)
      const r = await fetch('/api/upload/texture', { method: 'POST', body: fd })
      if (!r.ok) throw new Error(`Upload failed: ${r.status}`)
      const { url } = await r.json()
      setOssTextureUrl(url)
    } catch { /* ignore */ } finally { setUploadingTexture(false) }
  }, [textureDataUrl, uploadingTexture])

  /* ───────── Left rail tabs ───────── */
  const RAIL_TABS: { id: Exclude<LeftPanel, null>; icon: typeof LayoutGrid; label: string; toolOnOpen?: typeof tool }[] = [
    { id: 'design',   icon: LayoutGrid, label: '设计' },
    { id: 'ai',       icon: Sparkles,   label: 'AI' },
    { id: 'elements', icon: Smile,      label: '素材' },
    { id: 'upload',   icon: ImageUp,    label: '上传' },
    { id: 'text',     icon: Type,       label: '文字', toolOnOpen: 'text' },
    { id: 'draw',     icon: Pencil,     label: '绘图', toolOnOpen: 'paint' },
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
        ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
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
              color === c ? 'scale-110 ring-2 ring-violet-500' : 'hover:scale-110'
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

    if (tool === 'select') {
      if (!hasSelection) {
        return (
          <span className="text-xs text-neutral-500">
            选择工具：点击画布中的图层进行操作（快捷键 V）
          </span>
        )
      }
      return (
        <>
          <span className="text-xs font-medium text-neutral-700">已选中图层</span>
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
              className="w-28 accent-violet-600"
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
                    ? 'bg-violet-50 text-violet-700'
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
            className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-xs text-neutral-700 focus:border-violet-400 focus:outline-none"
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
            className="flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-medium text-white hover:bg-violet-700"
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
  }, [tool, hasSelection, color, brushSize, shapeType, fontSize, fontFamily, setShapeType, setColor, setBrushSize, setFontSize, setFontFamily])

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

  const designPanel = (
    <>
      {panelTitleBar('设计')}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">快速风格（AI）</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setAiPrompt(s.prompt); setLeftPanel('ai') }}
                className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2.5 py-2.5 text-left text-xs text-neutral-800 shadow-sm transition hover:border-violet-400 hover:shadow-md"
              >
                <span className="text-lg leading-none">{s.icon}</span>
                <span className="font-medium">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">色板</p>
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
                        color === c ? 'scale-110 ring-2 ring-violet-500' : 'hover:scale-110'
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
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <PaintBucket className="h-3.5 w-3.5" /> 用当前颜色填满车身
          </button>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">项目</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                const p = buildProjectEnvelope()
                if (p) { localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(p)); downloadJson(p, `tewan-project-${Date.now()}.json`) }
              }}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              导出工程
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              导入工程
            </button>
            <button
              type="button"
              onClick={() => textureDataUrl && localStorage.setItem(DRAFT_TEXTURE_KEY, textureDataUrl)}
              disabled={!textureDataUrl}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              保存草稿
            </button>
            <button
              type="button"
              onClick={() => { const d = localStorage.getItem(DRAFT_TEXTURE_KEY); if (d) setTextureDataUrl(d) }}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              读取草稿
            </button>
          </div>
          <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportProjectFile} />
          <button
            type="button"
            onClick={handleUploadTextureToOSS}
            disabled={!textureDataUrl || uploadingTexture}
            className="mt-2 w-full rounded-lg border border-neutral-200 bg-white py-2 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {uploadingTexture ? '上传中…' : '上传纹理到 OSS'}
          </button>
          {ossTextureUrl && (
            <a className="mt-1.5 block truncate text-center text-xs text-violet-600 underline" href={ossTextureUrl} target="_blank" rel="noreferrer">
              OSS 纹理链接 →
            </a>
          )}
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
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-violet-300'
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
              className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:border-violet-400 focus:outline-none"
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
                className="flex-1 rounded-lg bg-violet-600 py-2 text-xs font-medium text-white hover:bg-violet-700"
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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-violet-700 hover:to-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white py-3 text-xs text-neutral-700 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700"
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
                className="flex h-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-xl transition hover:border-violet-400 hover:bg-violet-50"
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
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 text-center transition hover:border-violet-400 hover:bg-violet-50"
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
                className="group flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-left transition hover:border-violet-400 hover:bg-violet-50"
              >
                <span
                  className="truncate text-neutral-900 group-hover:text-violet-700"
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
            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-800 focus:border-violet-400 focus:outline-none"
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
            className="w-full accent-violet-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
            <span>12</span><span className="text-violet-600 font-medium">{fontSize}</span><span>256</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => editorRef.current?.addText('TESLA', fontSize, fontFamily, color)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
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
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
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
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
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
            className="w-full accent-violet-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
            <span>细</span>
            <span className="text-violet-600 font-medium">{brushSize}px</span>
            <span>粗</span>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">颜色</p>
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
                        color === c ? 'scale-110 ring-2 ring-violet-500' : 'hover:scale-110'
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
            {layers.map((l) => (
              <li key={l.id}>
                <div
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs transition ${
                    l.active
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                  onClick={() => editorRef.current?.selectLayer(l.id)}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-neutral-200 bg-white text-[10px]">
                    {l.type === 'image' ? '图' : l.type === 'text' ? 'T' : l.type === 'shape' ? '◼' : '~'}
                  </span>
                  <span className="flex-1 truncate">{l.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); editorRef.current?.toggleLayerVisibility(l.id) }}
                    className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:text-neutral-700"
                    title={l.visible ? '隐藏图层' : '显示图层'}
                  >
                    {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); editorRef.current?.removeLayer(l.id) }}
                    className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                    title="删除图层"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )

  const activePanelNode = (() => {
    switch (leftPanel) {
      case 'design':   return designPanel
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
      <div className="flex gap-2">
        <button
          type="button"
          className={`flex-1 rounded-lg border py-1.5 text-xs transition ${
            materialFinish === 'gloss'
              ? 'border-violet-500 bg-violet-50 text-violet-700'
              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
          onClick={() => setMaterialFinish('gloss')}
        >
          亮光
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg border py-1.5 text-xs transition ${
            materialFinish === 'matte'
              ? 'border-violet-500 bg-violet-50 text-violet-700'
              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
          onClick={() => setMaterialFinish('matte')}
        >
          哑光
        </button>
      </div>
    </div>
  )

  const zoomPercent = Math.round(zoom * 100)

  return (
    <div className="relative flex h-[calc(100vh-64px)] min-h-[640px] w-full flex-col overflow-hidden bg-neutral-100 text-neutral-900">

      {/* ════════ Top Bar ════════ */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white">T</span>
          <h1 className="text-sm font-semibold text-neutral-900">高级贴膜编辑器</h1>
        </div>

        <div className="h-5 w-px bg-neutral-200" />

        <div className="relative">
          <select
            className="h-9 appearance-none rounded-xl border border-neutral-200 bg-white pl-3 pr-8 text-sm text-neutral-800 focus:border-violet-400 focus:outline-none"
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
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'
                }`}
                title="UV 贴膜模板参考线"
              >
                <Layers className="h-3.5 w-3.5" /> UV
              </button>
              {showUVMask && (
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={uvMaskOpacity}
                  onChange={(e) => setUVMaskOpacity(Number(e.target.value))}
                  className="w-20 accent-amber-500"
                  title={`${Math.round(uvMaskOpacity * 100)}%`}
                />
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
              ? 'border-violet-500 bg-violet-50 text-violet-700'
              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
          title="显示 / 隐藏 3D 预览"
        >
          <Box className="h-4 w-4" /> 3D 预览
        </button>

        <button
          type="button"
          className="hidden h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-700 hover:bg-neutral-50 md:flex"
        >
          <Share2 className="h-4 w-4" /> 分享
        </button>

        <button
          type="button"
          onClick={() => textureDataUrl && downloadDataUrl(textureDataUrl, `tewan-texture-${selectedModel.slug}-${Date.now()}.png`)}
          disabled={!textureDataUrl}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> 导出
        </button>
      </header>

      {/* ════════ Body: rail + panel + workspace ════════ */}
      <div className="flex min-h-0 flex-1">

        {/* Left rail */}
        <nav className="z-10 flex w-20 shrink-0 flex-col items-center gap-1 border-r border-neutral-200 bg-white px-2 py-3">
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
              onSelectionChange={setHasSelection}
              onHistoryChange={setHistory}
              onZoomChange={setZoom}
              onLayersChange={setLayers}
              uvMaskUrl={showUVMask ? selectedModel?.uv_mask_url : undefined}
              uvMaskNativeWidth={selectedModel?.uv_mask_native_width}
              uvMaskNativeHeight={selectedModel?.uv_mask_native_height}
              uvMaskOpacity={uvMaskOpacity}
              textureRotation={selectedModel?.uv_texture_rotation}
              workspaceBackground="#f3f4f6"
            />
          </div>

          {/* Bottom zoom bar */}
          <div className="z-10 flex h-10 shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-white px-4 text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <span>{selectedModel?.name ?? ''}</span>
              <span className="text-neutral-300">·</span>
              <span>1024 × 1024</span>
              <span className="text-neutral-300">·</span>
              <span>快捷键：V 选择 / B 画笔 / E 橡皮 / T 文字 / R 形状 / ⌘+滚轮 缩放 / 空格 拖动</span>
            </div>
            <div className="flex items-center gap-1">
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
                  materialFinish={materialFinish}
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
        className="fixed bottom-6 right-4 z-[100] flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition hover:scale-105 active:scale-95 md:hidden"
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
                materialFinish={materialFinish}
                autoRotate={autoRotate}
              />
            </div>
            <div className="shrink-0 border-t border-neutral-200">{previewControls}</div>
          </div>
        </div>
      )}
    </div>
  )
}
