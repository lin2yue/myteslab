'use client'

import { ChangeEvent, useMemo, useRef, useState } from 'react'
import { Canvas2DEditor, Canvas2DEditorRef, EditorProjectData } from './Canvas2DEditor'
import { CarPreview3D, MaterialDecision } from './CarPreview3D'
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

  const canvasEditorRef = useRef<Canvas2DEditorRef>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const [selectedModelSlug, setSelectedModelSlug] = useState(DEFAULT_MODELS[0]?.slug ?? '')
  const [ossTextureUrl, setOssTextureUrl] = useState<string | null>(null)
  const [uploadingTexture, setUploadingTexture] = useState(false)
  const [uploadingProject, setUploadingProject] = useState(false)
  const [materialDecisions, setMaterialDecisions] = useState<MaterialDecision[]>([])

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
      project
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
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: await dataUrlToBlob(textureDataUrl)
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      })
      if (!uploadRes.ok) throw new Error('上传失败')
      alert(`工程快照已上传：${signData.publicUrl ?? signData.ossKey}`)
    } catch {
      alert('上传工程快照失败')
    } finally {
      setUploadingProject(false)
    }
  }

  const included = materialDecisions.filter((d) => d.decision === 'included').length
  const excluded = materialDecisions.filter((d) => d.decision === 'excluded').length

  const btn = 'rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15 transition'

  return (
    <div className="relative h-[calc(100vh-64px)] min-h-[820px] overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#243b53_0%,#0b1120_45%,#04070f_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.08),transparent_18%)]" />

      <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 backdrop-blur-xl">
        <div>
          <h1 className="text-sm font-semibold tracking-wide">TEWAN 3D ADVANCED EDITOR</h1>
          <p className="text-[11px] text-slate-300">专业级包围改色编辑（R3F + Fabric）</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-300">车型</span>
          <select className="rounded-xl border border-white/20 bg-slate-900/80 px-3 py-2 text-xs" value={selectedModelSlug} onChange={(e) => setSelectedModelSlug(e.target.value)}>
            {DEFAULT_MODELS.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="absolute bottom-24 left-4 top-24 z-10 w-[420px] overflow-hidden rounded-2xl border border-white/15 bg-slate-950/65 p-3 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
          <span>2D 纹理工作台</span>
          <span>1024 × 1024</span>
        </div>
        <div className="h-full overflow-auto pr-1">
          <Canvas2DEditor ref={canvasEditorRef} />
        </div>
      </div>

      <div className="absolute inset-0 z-0 pt-20">
        <CarPreview3D modelUrl={selectedModel.model_3d_url} modelSlug={selectedModel.slug} textureDataUrl={textureDataUrl} onMaterialDecisions={setMaterialDecisions} />
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-30 rounded-2xl border border-white/15 bg-slate-950/70 p-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} onClick={() => textureDataUrl && downloadDataUrl(textureDataUrl, `tewan-texture-${selectedModel.slug}-${Date.now()}.png`)} disabled={!textureDataUrl}>导出纹理 PNG</button>
          <button className={btn} onClick={() => textureDataUrl && localStorage.setItem(DRAFT_TEXTURE_KEY, textureDataUrl)} disabled={!textureDataUrl}>保存纹理草稿</button>
          <button className={btn} onClick={() => { const d = localStorage.getItem(DRAFT_TEXTURE_KEY); if (d) setTextureDataUrl(d) }}>读取纹理草稿</button>

          <button className={btn} onClick={() => { const p = buildProjectEnvelope(); if (p) { localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(p)); downloadJson(p, `tewan-editor-project-${Date.now()}.json`) } }}>导出工程 JSON</button>
          <button className={btn} onClick={async () => { const raw = localStorage.getItem(PROJECT_STORAGE_KEY); if (raw) await hydrateProject(JSON.parse(raw) as ProjectEnvelope) }}>读取本地工程</button>
          <button className={btn} onClick={() => importInputRef.current?.click()}>导入工程文件</button>
          <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportProjectFile} />

          <button className={btn} onClick={handleUploadTextureToOSS} disabled={!textureDataUrl || uploadingTexture}>{uploadingTexture ? '上传中…' : '上传纹理到 OSS'}</button>
          <button className={btn} onClick={handleUploadProjectSnapshot} disabled={uploadingProject}>{uploadingProject ? '上传中…' : '上传工程快照到 OSS'}</button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-300">
          <span>材质映射：命中 {included} · 排除 {excluded}</span>
          {ossTextureUrl && <a className="text-cyan-300 underline" href={ossTextureUrl} target="_blank" rel="noreferrer">OSS 纹理链接</a>}
        </div>
      </div>
    </div>
  )
}
