'use client'

import { ChangeEvent, useMemo, useRef, useState } from 'react'
import { Sun, Moon, RotateCw, Pause, Box, X } from 'lucide-react'
import { Canvas2DEditor, Canvas2DEditorRef, EditorProjectData } from './Canvas2DEditor'
import { CarPreview3D } from './CarPreview3D'
import { useEditorStore } from '../store/useEditorStore'
import { DEFAULT_MODELS } from '@/config/models'

const DRAFT_TEXTURE_KEY = 'tewan-3d-editor:draft:texture'
const PROJECT_STORAGE_KEY = 'tewan-3d-editor:project:v1'

type ProjectEnvelope = {
  modelSlug: string
  savedAt: string
  textureDataUrl: string | null
  textureOssUrl?: string | null
  project: EditorProjectData
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return await res.blob()
}

export function Tewan3DEditorApp() {
  const textureDataUrl = useEditorStore((s) => s.textureDataUrl)
  const setTextureDataUrl = useEditorStore((s) => s.setTextureDataUrl)
  const materialFinish = useEditorStore((s) => s.materialFinish)
  const setMaterialFinish = useEditorStore((s) => s.setMaterialFinish)
  const lightingMode = useEditorStore((s) => s.lightingMode)
  const setLightingMode = useEditorStore((s) => s.setLightingMode)
  const autoRotate = useEditorStore((s) => s.autoRotate)
  const setAutoRotate = useEditorStore((s) => s.setAutoRotate)

  const canvasEditorRef = useRef<Canvas2DEditorRef>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const [selectedModelSlug, setSelectedModelSlug] = useState(DEFAULT_MODELS[0]?.slug ?? '')
  const [ossTextureUrl, setOssTextureUrl] = useState<string | null>(null)
  const [uploadingTexture, setUploadingTexture] = useState(false)
  const [uploadingProject, setUploadingProject] = useState(false)
  const [mobile3dOpen, setMobile3dOpen] = useState(false)

  const selectedModel = useMemo(
    () => DEFAULT_MODELS.find((m) => m.slug === selectedModelSlug) ?? DEFAULT_MODELS[0],
    [selectedModelSlug]
  )

  const buildProjectEnvelope = (): ProjectEnvelope | null => {
    const project = canvasEditorRef.current?.exportProject()
    if (!project) return null
    return {
      modelSlug: selectedModelSlug,
      savedAt: new Date().toISOString(),
      textureDataUrl,
      textureOssUrl: ossTextureUrl,
      project,
    }
  }

  const hydrateProject = async (parsed: ProjectEnvelope) => {
    if (parsed.modelSlug) setSelectedModelSlug(parsed.modelSlug)
    if (parsed.textureDataUrl) setTextureDataUrl(parsed.textureDataUrl)
    if (parsed.textureOssUrl) setOssTextureUrl(parsed.textureOssUrl)
    if (parsed.project && canvasEditorRef.current) await canvasEditorRef.current.importProject(parsed.project)
  }

  const handleImportProjectFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as ProjectEnvelope
      await hydrateProject(parsed)
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(parsed))
    } catch {
      alert('工程文件解析失败，请检查 JSON 格式')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const handleUploadTextureToOSS = async () => {
    if (!textureDataUrl) return
    setUploadingTexture(true)
    try {
      const signRes = await fetch('/api/editor/get-texture-upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const signData = await signRes.json()
      if (!signData.success) throw new Error(signData.error || '签名失败')
      const uploadRes = await fetch(signData.uploadUrl, {
        method: 'PUT', headers: { 'Content-Type': 'image/png' },
        body: await dataUrlToBlob(textureDataUrl),
      })
      if (!uploadRes.ok) throw new Error('上传失败')
      setOssTextureUrl(signData.publicUrl ?? signData.ossKey)
    } catch {
      alert('上传 OSS 失败，请检查登录态与 OSS 配置')
    } finally {
      setUploadingTexture(false)
    }
  }

  const handleUploadProjectSnapshot = async () => {
    const payload = buildProjectEnvelope()
    if (!payload) return
    setUploadingProject(true)
    try {
      const signRes = await fetch('/api/editor/get-project-upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const signData = await signRes.json()
      if (!signData.success) throw new Error(signData.error || '签名失败')
      const uploadRes = await fetch(signData.uploadUrl, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      })
      if (!uploadRes.ok) throw new Error('上传失败')
      alert(`工程快照已上传：${signData.publicUrl ?? signData.ossKey}`)
    } catch {
      alert('上传工程快照失败')
    } finally {
      setUploadingProject(false)
    }
  }

  const sceneBtnCls = (active: boolean) =>
    `flex-1 rounded-xl border py-2.5 text-xs font-medium transition ${active ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-900 dark:border-cyan-400/60 dark:bg-cyan-400/15 dark:text-cyan-100' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'}`

  const exportBtnCls =
    'w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs text-neutral-800 transition hover:bg-neutral-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'

  const previewBlock = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-none">
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

      {/* 与 AI 设计页相同的 3D 控制条 */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLightingMode(lightingMode === 'day' ? 'garage' : 'day')}
          className="btn-secondary flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs sm:flex-none sm:px-4"
        >
          {lightingMode === 'garage' ? (
            <>
              <Sun className="h-4 w-4" />
              <span className="hidden sm:inline">浅色背景</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              <span className="hidden sm:inline">深色背景</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          className={`btn-secondary flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs sm:flex-none sm:px-4 ${autoRotate ? 'bg-black/10 dark:bg-white/10' : ''}`}
        >
          {autoRotate ? (
            <>
              <Pause className="h-4 w-4" />
              <span className="hidden sm:inline">暂停旋转</span>
            </>
          ) : (
            <>
              <RotateCw className="h-4 w-4" />
              <span className="hidden sm:inline">自动旋转</span>
            </>
          )}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-neutral-600 dark:text-slate-300">材质光泽</p>
        <div className="flex gap-2">
          <button type="button" className={sceneBtnCls(materialFinish === 'gloss')} onClick={() => setMaterialFinish('gloss')}>
            亮光
          </button>
          <button type="button" className={sceneBtnCls(materialFinish === 'matte')} onClick={() => setMaterialFinish('matte')}>
            哑光
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-neutral-500 dark:text-slate-500">
          {materialFinish === 'gloss' ? '高反射，金属质感强' : '低反射，消光磨砂感'}
        </p>
      </div>

      <div className="border-t border-neutral-200 pt-3 dark:border-white/10">
        <p className="mb-2 text-xs font-semibold text-neutral-600 dark:text-slate-300">导出与工程</p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            className={exportBtnCls}
            onClick={() => textureDataUrl && downloadDataUrl(textureDataUrl, `tewan-texture-${selectedModel.slug}-${Date.now()}.png`)}
            disabled={!textureDataUrl}
          >
            导出纹理 PNG（1024²）
          </button>
          <button type="button" className={exportBtnCls} onClick={() => textureDataUrl && localStorage.setItem(DRAFT_TEXTURE_KEY, textureDataUrl)} disabled={!textureDataUrl}>
            保存草稿
          </button>
          <button type="button" className={exportBtnCls} onClick={() => { const d = localStorage.getItem(DRAFT_TEXTURE_KEY); if (d) setTextureDataUrl(d) }}>
            读取草稿
          </button>
          <button
            type="button"
            className={exportBtnCls}
            onClick={() => {
              const p = buildProjectEnvelope()
              if (p) {
                localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(p))
                downloadJson(p, `tewan-project-${Date.now()}.json`)
              }
            }}
          >
            导出工程 JSON
          </button>
          <button
            type="button"
            className={exportBtnCls}
            onClick={async () => {
              const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
              if (raw) await hydrateProject(JSON.parse(raw) as ProjectEnvelope)
            }}
          >
            读取本地工程
          </button>
          <button type="button" className={exportBtnCls} onClick={() => importInputRef.current?.click()}>
            导入工程文件
          </button>
          <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportProjectFile} />
          <button type="button" className={exportBtnCls} onClick={handleUploadTextureToOSS} disabled={!textureDataUrl || uploadingTexture}>
            {uploadingTexture ? '上传中…' : '上传纹理到 OSS'}
          </button>
          <button type="button" className={exportBtnCls} onClick={handleUploadProjectSnapshot} disabled={uploadingProject}>
            {uploadingProject ? '上传中…' : '上传工程快照'}
          </button>
          {ossTextureUrl && (
            <a className="block text-center text-xs text-cyan-600 underline dark:text-cyan-300" href={ossTextureUrl} target="_blank" rel="noreferrer">
              OSS 纹理链接 →
            </a>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative flex h-[calc(100vh-64px)] min-h-[640px] w-full flex-col overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-white lg:flex-row">
      {/* 主工作区：参考 tesla-wrap 高级编辑器 — 全屏工作台 + 中央 UV */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-4">
        <header className="mb-3 flex flex-shrink-0 flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div>
            <h1 className="text-base font-semibold tracking-tight">高级贴膜编辑</h1>
            <p className="mt-0.5 max-w-xl text-xs text-neutral-500 dark:text-neutral-400">
              UV 模板绘制 · 右侧 3D 与 AI 设计页同款 model-viewer（浅色/深色背景、自动旋转一致）
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 dark:border-white/20 dark:bg-zinc-900 dark:text-white"
              value={selectedModelSlug}
              onChange={(e) => setSelectedModelSlug(e.target.value)}
            >
              {DEFAULT_MODELS.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              onClick={() => textureDataUrl && downloadDataUrl(textureDataUrl, `tewan-texture-${selectedModel.slug}-${Date.now()}.png`)}
              disabled={!textureDataUrl}
            >
              导出 PNG
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          <Canvas2DEditor ref={canvasEditorRef} layout="studio" />
        </div>
      </main>

      {/* 桌面端：右侧 3D 栏（参考站 hidden md:block 的桌面布局） */}
      <aside className="hidden min-h-0 w-[400px] max-w-full shrink-0 flex-col border-l border-neutral-200 bg-white/90 p-4 backdrop-blur-md dark:border-neutral-800 dark:bg-zinc-950/95 lg:flex">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">3D 预览</h2>
        {previewBlock}
      </aside>

      {/* 移动端：浮动进入全屏 3D（参考站 bottom-20 right-4 FAB） */}
      <button
        type="button"
        aria-label="打开 3D 预览"
        className="fixed bottom-20 right-4 z-[100] flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition hover:scale-105 active:scale-95 dark:bg-white dark:text-neutral-900 lg:hidden"
        onClick={() => setMobile3dOpen(true)}
      >
        <Box className="h-5 w-5" aria-hidden />
      </button>

      {mobile3dOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-950/90 p-4 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="3D 预览"
        >
          <div
            className="relative flex h-full max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-white hover:bg-neutral-700"
              onClick={() => setMobile3dOpen(false)}
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-3 pl-12 text-sm font-semibold text-white">3D 预览</h2>
            <div className="min-h-0 flex-1 overflow-y-auto">{previewBlock}</div>
          </div>
        </div>
      )}
    </div>
  )
}
