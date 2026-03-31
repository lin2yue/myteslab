'use client'

import { ChangeEvent, useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  Sun, Moon, RotateCw, Pause, Box, X,
  Sparkles, ImageUp, Download,
  Wand2, Eye, EyeOff, Layers,
  MousePointer2, Pencil, Eraser, Square, Type, Smile,
  PaintBucket, ChevronUp, ChevronDown, Trash2, Undo2,
} from 'lucide-react'
import { Canvas2DEditor, Canvas2DEditorRef, EditorProjectData } from './Canvas2DEditor'
import { CarPreview3D } from './CarPreview3D'
import { DraggablePanel3D } from './DraggablePanel3D'
import { useEditorStore } from '../store/useEditorStore'
import { DEFAULT_MODELS, type ModelConfig } from '@/config/models'

/* ——— Constants ——— */
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

const QUICK_COLORS = [
  '#ffffff', '#0f172a', '#ef4444', '#f97316', '#f59e0b',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#94a3b8', '#713f12',
]

const FONT_FAMILIES = ['Inter', 'Arial', 'Georgia', 'Courier New', 'Impact', 'Times New Roman']

const STICKERS = [
  { id: 's1', label: '🔥' }, { id: 's2', label: '⚡' }, { id: 's3', label: '🏁' }, { id: 's4', label: '⭐' },
  { id: 's5', label: '💀' }, { id: 's6', label: '👑' }, { id: 's7', label: '💎' }, { id: 's8', label: '🚀' },
  { id: 's9', label: '🎯' }, { id: 's10', label: '🦅' }, { id: 's11', label: '🐉' }, { id: 's12', label: '🌊' },
  { id: 's13', label: '☠️' }, { id: 's14', label: '🎪' }, { id: 's15', label: '🏆' }, { id: 's16', label: '🎸' },
]

type ProjectEnvelope = {
  modelSlug: string
  savedAt: string
  textureDataUrl: string | null
  textureOssUrl?: string | null
  project: EditorProjectData
}

type SidebarTab = 'ai' | 'upload' | 'export'

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

/* ——— Tool definitions ——— */
type ToolId = 'select' | 'paint' | 'erase' | 'shape' | 'text' | 'sticker'
const TOOLS: { id: ToolId; Icon: React.ElementType; label: string; shortcut?: string }[] = [
  { id: 'select', Icon: MousePointer2, label: '选择', shortcut: 'V' },
  { id: 'paint',  Icon: Pencil,        label: '画笔', shortcut: 'B' },
  { id: 'erase',  Icon: Eraser,        label: '橡皮', shortcut: 'E' },
  { id: 'shape',  Icon: Square,        label: '形状', shortcut: 'R' },
  { id: 'text',   Icon: Type,          label: '文字', shortcut: 'T' },
  { id: 'sticker',Icon: Smile,         label: '贴纸', shortcut: 'S' },
]

export function Tewan3DEditorApp({ models: propModels }: { models?: ModelConfig[] } = {}) {
  // Use models passed from server (DB fetch) or fall back to DEFAULT_MODELS
  const MODELS = propModels && propModels.length > 0 ? propModels : DEFAULT_MODELS
  /* ——— Store ——— */
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
  const tool = useEditorStore((s) => s.tool) as ToolId
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

  /* ——— Local state ——— */
  const canvasEditorRef = useRef<Canvas2DEditorRef>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const uploadImageInputRef = useRef<HTMLInputElement | null>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedModelSlug, setSelectedModelSlug] = useState(MODELS[0]?.slug ?? '')
  const [ossTextureUrl, setOssTextureUrl] = useState<string | null>(null)
  const [uploadingTexture, setUploadingTexture] = useState(false)
  const [mobile3dOpen, setMobile3dOpen] = useState(false)
  const [panel3DVisible, setPanel3DVisible] = useState(true)
  const [activeTab, setActiveTab] = useState<SidebarTab>('ai')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGeneratedUrl, setAiGeneratedUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [showUVMask, setShowUVMask] = useState(true)
  const [uvMaskOpacity, setUVMaskOpacity] = useState(0.35)
  // sticker panel in toolbar
  const [showStickerPanel, setShowStickerPanel] = useState(false)
  // Texture rotated to match 3D model UV expectations (mirrors OSS rotate processing)
  const [rotatedTextureDataUrl, setRotatedTextureDataUrl] = useState<string | null>(null)

  const selectedModel = useMemo(
    () => MODELS.find((m) => m.slug === selectedModelSlug) ?? MODELS[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedModelSlug, MODELS]
  )

  /* ——— Rotate canvas texture before 3D model (mirrors OSS processing) ——— */
  // cybertruck: 90° CW, all others: 180°, so 3D model UV coordinates align correctly.
  useEffect(() => {
    if (!textureDataUrl) { setRotatedTextureDataUrl(null); return }
    const rotation = selectedModel?.uv_texture_rotation ?? 0
    if (!rotation) { setRotatedTextureDataUrl(textureDataUrl); return }

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) { setRotatedTextureDataUrl(textureDataUrl); return }
      if (rotation === 180) {
        canvas.width = img.width; canvas.height = img.height
        ctx.translate(img.width, img.height)
        ctx.rotate(Math.PI)
      } else if (rotation === 90) {
        // 90° CW: new width = original height, new height = original width
        canvas.width = img.height; canvas.height = img.width
        ctx.translate(img.height, 0)
        ctx.rotate(Math.PI / 2)
      }
      ctx.drawImage(img, 0, 0)
      setRotatedTextureDataUrl(canvas.toDataURL('image/png'))
    }
    img.src = textureDataUrl
  }, [textureDataUrl, selectedModel])

  /* ——— Project helpers ——— */
  const buildProjectEnvelope = (): ProjectEnvelope | null => {
    const project = canvasEditorRef.current?.exportProject()
    if (!project) return null
    return { modelSlug: selectedModelSlug, savedAt: new Date().toISOString(), textureDataUrl, textureOssUrl: ossTextureUrl, project }
  }

  const hydrateProject = async (envelope: ProjectEnvelope) => {
    if (envelope.modelSlug) setSelectedModelSlug(envelope.modelSlug)
    if (envelope.project && canvasEditorRef.current) {
      await canvasEditorRef.current.importProject(envelope.project)
    }
    if (envelope.textureOssUrl) setOssTextureUrl(envelope.textureOssUrl)
  }

  /* ——— AI Generate ——— */
  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || aiGenerating) return
    setAiGenerating(true); setAiError(null); setAiGeneratedUrl(null)
    try {
      const res = await fetch('/api/wrap/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt }) })
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
    canvasEditorRef.current?.addImageFromDataUrl(aiGeneratedUrl)
    setAiGeneratedUrl(null)
  }, [aiGeneratedUrl])

  /* ——— Upload ——— */
  const handleUploadImageFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 10 * 1024 * 1024) { setUploadError('文件最大 10MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (dataUrl && canvasEditorRef.current) canvasEditorRef.current.addImageFromDataUrl(dataUrl)
    }
    reader.readAsDataURL(file)
    if (uploadImageInputRef.current) uploadImageInputRef.current.value = ''
  }, [])

  /* ——— Import project ——— */
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

  /* ——— Upload OSS ——— */
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

  /* ——— 3D Controls ——— */
  const sceneBtnCls = (active: boolean) => `flex-1 rounded-xl border py-2.5 text-xs font-medium transition ${active ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-900 dark:border-cyan-400/60 dark:bg-cyan-400/15 dark:text-cyan-100' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'}`
  const previewControls = (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setLightingMode(lightingMode === 'day' ? 'garage' : 'day')} className="btn-secondary flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs">
          {lightingMode === 'garage' ? <><Sun className="h-3.5 w-3.5" /><span>浅色</span></> : <><Moon className="h-3.5 w-3.5" /><span>深色</span></>}
        </button>
        <button type="button" onClick={() => setAutoRotate(!autoRotate)} className={`btn-secondary flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs ${autoRotate ? 'bg-black/10 dark:bg-white/10' : ''}`}>
          {autoRotate ? <><Pause className="h-3.5 w-3.5" /><span>暂停</span></> : <><RotateCw className="h-3.5 w-3.5" /><span>旋转</span></>}
        </button>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400">材质</p>
        <div className="flex gap-2">
          <button type="button" className={sceneBtnCls(materialFinish === 'gloss')} onClick={() => setMaterialFinish('gloss')}>亮光</button>
          <button type="button" className={sceneBtnCls(materialFinish === 'matte')} onClick={() => setMaterialFinish('matte')}>哑光</button>
        </div>
      </div>
    </div>
  )

  const exportBtnCls = 'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs text-neutral-800 transition hover:bg-neutral-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'

  /* ——— Sidebar tab content ——— */
  const aiTab = (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">快速风格</p>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_STYLES.map((style) => (
            <button key={style.id} type="button"
              className={`flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-2 py-2.5 text-left text-xs text-white transition hover:border-cyan-400/50 hover:bg-white/10 ${aiPrompt === style.prompt ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-100' : ''}`}
              onClick={() => setAiPrompt(style.prompt)}>
              <span className="text-lg leading-none">{style.icon}</span>
              <span className="font-medium">{style.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">自定义描述</p>
        <div className="relative">
          <textarea className="w-full resize-none rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400/50 focus:outline-none" rows={3} maxLength={200}
            placeholder="描述你想要的车身风格..." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
          <span className="absolute bottom-2 right-3 text-[10px] text-slate-500">{aiPrompt.length}/200</span>
        </div>
      </div>
      {aiError && <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">{aiError}</div>}
      {aiGeneratedUrl && !aiGenerating && (
        <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={aiGeneratedUrl} alt="AI 生成结果" className="w-full object-cover" />
          <div className="flex gap-2 p-2">
            <button type="button" className="flex-1 rounded-lg bg-cyan-500/20 border border-cyan-400/40 py-2 text-xs text-cyan-100 font-medium hover:bg-cyan-500/30 transition" onClick={handleAddAIImageToCanvas}>添加到画布</button>
            <button type="button" className="flex-1 rounded-lg border border-white/15 bg-white/10 py-2 text-xs text-white hover:bg-white/20 transition" onClick={() => setAiGeneratedUrl(null)}>重新生成</button>
          </div>
        </div>
      )}
      <button type="button" disabled={!aiPrompt.trim() || aiGenerating} onClick={handleAIGenerate}
        className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 py-3 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {aiGenerating ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />生成中...</> : <><Wand2 className="h-4 w-4" />AI 生成</>}
      </button>
      <p className="text-[10px] text-slate-500 text-center">AI 生成的纹理可直接添加到画布上编辑</p>
    </div>
  )

  const uploadTab = (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">上传图片到画布</p>
        <p className="mb-3 text-xs text-slate-400 leading-relaxed">支持 JPG、PNG、WebP、SVG 格式，图片会自动居中适配画布</p>
      </div>
      <button type="button" className="w-full rounded-2xl border-2 border-dashed border-white/20 bg-black/20 p-6 text-center transition hover:border-cyan-400/50 hover:bg-white/5" onClick={() => uploadImageInputRef.current?.click()}>
        <ImageUp className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <p className="text-sm font-medium text-slate-300">点击上传图片</p>
        <p className="mt-1 text-xs text-slate-500">JPG / PNG / WebP / SVG</p>
      </button>
      <input ref={uploadImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadImageFile} />
      {uploadError && <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">{uploadError}</div>}
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-400 leading-relaxed">
        上传后图片以图层形式添加到画布，可自由移动、缩放、旋转，可结合画笔工具二次创作。
      </div>
    </div>
  )

  const exportTab = (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-slate-400">导出纹理</p>
        <button type="button" className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 disabled:opacity-50"
          onClick={() => textureDataUrl && downloadDataUrl(textureDataUrl, `tewan-texture-${selectedModel.slug}-${Date.now()}.png`)} disabled={!textureDataUrl}>
          导出纹理 PNG（1024×1024）
        </button>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-slate-400">草稿</p>
        <div className="flex gap-2">
          <button type="button" className={exportBtnCls} onClick={() => textureDataUrl && localStorage.setItem(DRAFT_TEXTURE_KEY, textureDataUrl)} disabled={!textureDataUrl}>保存草稿</button>
          <button type="button" className={exportBtnCls} onClick={() => { const d = localStorage.getItem(DRAFT_TEXTURE_KEY); if (d) setTextureDataUrl(d) }}>读取草稿</button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-slate-400">工程文件</p>
        <div className="flex flex-col gap-1.5">
          <button type="button" className={exportBtnCls} onClick={() => { const p = buildProjectEnvelope(); if (p) { localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(p)); downloadJson(p, `tewan-project-${Date.now()}.json`) } }}>导出工程 JSON</button>
          <button type="button" className={exportBtnCls} onClick={async () => { const raw = localStorage.getItem(PROJECT_STORAGE_KEY); if (raw) await hydrateProject(JSON.parse(raw) as ProjectEnvelope) }}>读取本地工程</button>
          <button type="button" className={exportBtnCls} onClick={() => importInputRef.current?.click()}>导入工程文件</button>
          <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportProjectFile} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-slate-400">云端上传</p>
        <button type="button" className={exportBtnCls} onClick={handleUploadTextureToOSS} disabled={!textureDataUrl || uploadingTexture}>{uploadingTexture ? '上传中…' : '上传纹理到 OSS'}</button>
        {ossTextureUrl && <a className="mt-1.5 block text-center text-xs text-cyan-600 underline dark:text-cyan-300" href={ossTextureUrl} target="_blank" rel="noreferrer">OSS 纹理链接 →</a>}
      </div>
    </div>
  )

  const TABS: { id: SidebarTab; icon: React.ElementType; label: string }[] = [
    { id: 'ai', icon: Sparkles, label: 'AI' },
    { id: 'upload', icon: ImageUp, label: '上传' },
    { id: 'export', icon: Download, label: '导出' },
  ]

  /* ——— Canvas Toolbar context options ——— */
  const toolbarContextOptions = (() => {
    if (tool === 'select') {
      if (!hasSelection) return null
      return (
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-px bg-white/20" />
          <span className="text-[10px] text-slate-400">已选中：</span>
          <button type="button" title="置顶" onClick={() => canvasEditorRef.current?.bringToFront()}
            className="flex h-7 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 text-xs text-white hover:bg-white/15 transition">
            <ChevronUp className="h-3 w-3" />置顶
          </button>
          <button type="button" title="置底" onClick={() => canvasEditorRef.current?.sendToBack()}
            className="flex h-7 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 text-xs text-white hover:bg-white/15 transition">
            <ChevronDown className="h-3 w-3" />置底
          </button>
          <button type="button" title="删除" onClick={() => canvasEditorRef.current?.deleteSelected()}
            className="flex h-7 items-center gap-1 rounded-lg border border-red-400/40 bg-red-500/10 px-2 text-xs text-red-300 hover:bg-red-500/20 transition">
            <Trash2 className="h-3 w-3" />删除
          </button>
        </div>
      )
    }
    if (tool === 'paint' || tool === 'erase') {
      return (
        <div className="flex items-center gap-3">
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">粗细</span>
            <input type="range" min={2} max={80} value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24" />
            <span className="min-w-[32px] text-[10px] text-white">{brushSize}px</span>
          </div>
        </div>
      )
    }
    if (tool === 'shape') {
      return (
        <div className="flex items-center gap-2">
          <div className="h-4 w-px bg-white/20" />
          <select className="h-7 rounded-lg border border-white/20 bg-slate-900 px-2 text-xs text-white" value={shapeType} onChange={(e) => setShapeType(e.target.value as 'rect' | 'circle' | 'line')}>
            <option value="rect">矩形</option>
            <option value="circle">圆形</option>
            <option value="line">线条</option>
          </select>
          <button type="button" onClick={() => canvasEditorRef.current?.addShape(shapeType, color)}
            className="h-7 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 text-xs text-white hover:bg-cyan-500/30 transition">
            添加
          </button>
        </div>
      )
    }
    if (tool === 'text') {
      return (
        <div className="flex items-center gap-2">
          <div className="h-4 w-px bg-white/20" />
          <select className="h-7 rounded-lg border border-white/20 bg-slate-900 px-2 text-xs text-white max-w-[120px]"
            value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
            {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-white/20 bg-white/10 text-xs text-white" onClick={() => setFontSize(Math.max(12, fontSize - 8))}>−</button>
            <span className="min-w-[28px] text-center text-xs text-white">{fontSize}</span>
            <button type="button" className="flex h-6 w-6 items-center justify-center rounded border border-white/20 bg-white/10 text-xs text-white" onClick={() => setFontSize(Math.min(256, fontSize + 8))}>+</button>
          </div>
          <button type="button" onClick={() => canvasEditorRef.current?.addText('TESLA', fontSize, fontFamily, color)}
            className="h-7 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 text-xs text-white hover:bg-cyan-500/30 transition">
            添加文字
          </button>
        </div>
      )
    }
    if (tool === 'sticker') {
      return (
        <div className="flex items-center gap-2">
          <div className="h-4 w-px bg-white/20" />
          <span className="text-[10px] text-slate-400">点击下方贴纸添加到画布</span>
        </div>
      )
    }
    return null
  })()

  return (
    <div className="relative flex h-[calc(100vh-64px)] min-h-[640px] w-full overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">

      {/* ——— Left Sidebar ——— */}
      <aside className="relative z-10 flex w-[280px] shrink-0 flex-col border-r border-neutral-200 bg-slate-950 dark:border-neutral-800">
        {/* Model Selector + 3D Toggle */}
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-3">
          <select className="flex-1 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400/50 focus:outline-none"
            value={selectedModelSlug} onChange={(e) => setSelectedModelSlug(e.target.value)}>
            {MODELS.map((m) => <option key={m.slug} value={m.slug} className="bg-slate-900">{m.name}</option>)}
          </select>
          <button type="button" title={panel3DVisible ? '隐藏 3D 预览' : '显示 3D 预览'}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${panel3DVisible ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-300' : 'border-white/15 bg-white/5 text-slate-400 hover:text-white'}`}
            onClick={() => setPanel3DVisible((v) => !v)}>
            {panel3DVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex shrink-0 gap-0.5 border-b border-white/10 bg-black/20 px-2 py-1.5">
          {TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition ${activeTab === tab.id ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'ai' && aiTab}
          {activeTab === 'upload' && uploadTab}
          {activeTab === 'export' && exportTab}
        </div>
      </aside>

      {/* ——— Main Canvas Area ——— */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0d1117]">

        {/* ── Top bar ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">高级贴膜编辑</span>
            {selectedModel?.uv_mask_url && (
              <div className="flex items-center gap-2">
                <button type="button" title={showUVMask ? '隐藏 UV 遮罩' : '显示 UV 遮罩'}
                  onClick={() => setShowUVMask((v) => !v)}
                  className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition ${showUVMask ? 'border-amber-400/60 bg-amber-400/15 text-amber-300' : 'border-white/15 bg-white/5 text-slate-400 hover:text-white'}`}>
                  <Layers className="h-3 w-3" />UV
                </button>
                {showUVMask && (
                  <input type="range" min={0.05} max={0.8} step={0.05} value={uvMaskOpacity}
                    onChange={(e) => setUVMaskOpacity(Number(e.target.value))}
                    className="w-16" title={`${Math.round(uvMaskOpacity * 100)}%`} />
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => canvasEditorRef.current?.clearCanvas()}
              className="flex h-7 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[11px] text-slate-400 hover:text-white transition">
              <Undo2 className="h-3 w-3" />清空
            </button>
            <button type="button"
              className="rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-40"
              onClick={() => textureDataUrl && downloadDataUrl(textureDataUrl, `tewan-texture-${selectedModel.slug}-${Date.now()}.png`)}
              disabled={!textureDataUrl}>
              导出 PNG
            </button>
          </div>
        </div>

        {/* ── Canvas Toolbar (Canva-style floating bar) ── */}
        <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-[#1c2128] px-3 py-2">
          {/* Tool buttons */}
          <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-black/30 p-0.5">
            {TOOLS.map(({ id, Icon, label }) => (
              <button key={id} type="button" title={`${label}`}
                onClick={() => { setTool(id); if (id === 'sticker') setShowStickerPanel((v) => !v); else setShowStickerPanel(false) }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${tool === id ? 'bg-white text-neutral-900 shadow' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          {/* Color (shown for paint/shape/text/sticker tools) */}
          {tool !== 'select' && tool !== 'erase' && (
            <div className="flex items-center gap-2 ml-1">
              <div className="h-4 w-px bg-white/20" />
              <div className="flex items-center gap-1.5">
                <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border-2 border-white/30" style={{ backgroundColor: color }}>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
                <div className="flex gap-1">
                  {QUICK_COLORS.slice(0, 8).map((c) => (
                    <button key={c} type="button" aria-label={c}
                      className={`h-5 w-5 rounded-full border transition ${color === c ? 'border-white ring-1 ring-white/60 scale-110' : 'border-white/20 hover:scale-105'}`}
                      style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fill background button */}
          {tool !== 'select' && tool !== 'erase' && (
            <button type="button" title="一键填色" onClick={() => canvasEditorRef.current?.fillAll(color)}
              className="flex h-7 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white transition ml-1">
              <PaintBucket className="h-3.5 w-3.5" />填色
            </button>
          )}

          {/* Contextual tool options */}
          {toolbarContextOptions}
        </div>

        {/* ── Sticker panel (dropdown below toolbar) ── */}
        {tool === 'sticker' && showStickerPanel && (
          <div className="absolute left-0 right-0 z-30 border-b border-white/10 bg-[#1c2128] px-3 py-2 shadow-lg"
            style={{ top: '88px' }}>
            <div className="flex flex-wrap gap-1.5">
              {STICKERS.map((s) => (
                <button key={s.id} type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-2xl transition hover:border-cyan-400/50 hover:bg-white/10"
                  onClick={() => { canvasEditorRef.current?.addSticker(s.label); setShowStickerPanel(false) }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Canvas ── */}
        <div className="min-h-0 flex-1">
          <Canvas2DEditor
            ref={canvasEditorRef}
            layout="canvas-only"
            onSelectionChange={setHasSelection}
            uvMaskUrl={showUVMask ? selectedModel?.uv_mask_url : undefined}
            uvMaskNativeWidth={selectedModel?.uv_mask_native_width}
            uvMaskNativeHeight={selectedModel?.uv_mask_native_height}
            uvMaskOpacity={uvMaskOpacity}
            uvMaskRotation={selectedModel?.uv_texture_rotation}
          />
        </div>
      </main>

      {/* ——— Desktop: Floating Draggable 3D Panel ——— */}
      {panel3DVisible && (
        <div className="hidden md:block">
          <DraggablePanel3D
            defaultSize={{ width: 480, height: 400 }}
            minSize={{ width: 300, height: 240 }}
            title="3D 预览"
            allowFullscreen
            onClose={() => setPanel3DVisible(false)}
          >
            <div className="flex h-full flex-col">
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <CarPreview3D
                  modelUrl={selectedModel.model_3d_url}
                  wheelUrl={selectedModel.wheel_url}
                  modelSlug={selectedModel.slug}
                  textureDataUrl={rotatedTextureDataUrl}
                  lightingMode={lightingMode}
                  materialFinish={materialFinish}
                  autoRotate={autoRotate}
                />
              </div>
              <div className="shrink-0 border-t border-neutral-100 dark:border-white/10">
                {previewControls}
              </div>
            </div>
          </DraggablePanel3D>
        </div>
      )}

      {/* ——— Mobile: FAB ——— */}
      <button type="button" aria-label="打开 3D 预览"
        className="fixed bottom-20 right-4 z-[100] flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:scale-105 active:scale-95 dark:bg-white dark:text-neutral-900 md:hidden"
        onClick={() => setMobile3dOpen(true)}>
        <Box className="h-5 w-5" aria-hidden />
      </button>

      {/* ——— Mobile: 3D Modal ——— */}
      {mobile3dOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-950/90 p-4 md:hidden" role="dialog" aria-modal="true">
          <div className="relative flex h-full max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-white">3D 预览</h2>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-white hover:bg-neutral-700" onClick={() => setMobile3dOpen(false)} aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              <CarPreview3D modelUrl={selectedModel.model_3d_url} wheelUrl={selectedModel.wheel_url} modelSlug={selectedModel.slug} textureDataUrl={rotatedTextureDataUrl} lightingMode={lightingMode} materialFinish={materialFinish} autoRotate={autoRotate} />
            </div>
            <div className="shrink-0 border-t border-white/10">{previewControls}</div>
          </div>
        </div>
      )}
    </div>
  )
}
