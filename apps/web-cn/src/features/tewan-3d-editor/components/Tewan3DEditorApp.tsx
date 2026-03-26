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
  const [lightingMode, setLightingMode] = useState<'day' | 'night'>('day')
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
    <div className="relative h-[calc(100vh-64px)] min-h-[860px] overflow-hidden bg-[#05070d] text-white">
      <div className="absolute inset-0 z-0">
        <CarPreview3D
          modelUrl={selectedModel.model_3d_url}
          modelSlug={selectedModel.slug}
          textureDataUrl={textureDataUrl}
          lightingMode={lightingMode}
          onMaterialDecisions={setMaterialDecisions}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_18%_20%,rgba(38,72,140,0.25),transparent_36%),radial-gradient(circle_at_82%_22%,rgba(47,80,153,0.2),transparent_34%),linear-gradient(to_bottom,rgba(5,8,18,0.28),rgba(3,5,12,0.72))]" />

      <div className="absolute left-5 right-5 top-5 z-30 flex items-center justify-between rounded-2xl border border-white/20 bg-slate-950/58 px-5 py-3 backdrop-blur-xl">
        <div>
          <h1 className="text-sm font-semibold tracking-[0.14em]">TEWAN STUDIO · 3D EDITOR</h1>
          <p className="text-[11px] text-slate-300">Professional Wrap Design Workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded-xl border border-white/20 bg-slate-900/80 px-3 py-2 text-xs" value={selectedModelSlug} onChange={(e) => setSelectedModelSlug(e.target.value)}>
            {DEFAULT_MODELS.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
          </select>
          <button className={btn} onClick={() => setLightingMode((v) => (v === 'day' ? 'night' : 'day'))}>{lightingMode === 'day' ? '白天' : '暗夜'}</button>
        </div>
      </div>

      <div className="absolute bottom-28 left-5 top-24 z-30 w-[430px] rounded-3xl border border-white/20 bg-slate-950/65 p-3 shadow-[0_30px_100px_rgba(0,0,0,.55)] backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-300"><span>2D Texture Canvas</span><span>LIVE UV</span></div>
        <div className="h-[calc(100%-28px)] overflow-auto pr-1">
          <Canvas2DEditor ref={canvasEditorRef} />
        </div>
      </div>

      <div className="absolute right-5 top-24 z-30 w-[300px] rounded-3xl border border-white/20 bg-slate-950/65 p-3 text-xs shadow-[0_30px_100px_rgba(0,0,0,.55)] backdrop-blur-xl">
        <p className="mb-2 font-semibold text-slate-100">材质映射诊断</p>
        <p className="text-slate-300">命中 {included} ｜ 排除 {excluded}</p>
        <div className="mt-2 max-h-[220px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px] text-slate-300">
          {materialDecisions.slice(0, 60).map((d, idx) => (
            <div key={`${d.materialName}-${idx}`} className={d.decision === 'included' ? 'text-emerald-300' : 'text-rose-300'}>
              {d.decision === 'included' ? '✓' : '✕'} {d.meshName || '(mesh)'} / {d.materialName || '(mat)'}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-5 left-5 right-5 z-40 rounded-2xl border border-white/20 bg-slate-950/70 p-3 backdrop-blur-2xl">
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
          {ossTextureUrl && <a className="text-cyan-300 underline text-xs" href={ossTextureUrl} target="_blank" rel="noreferrer">OSS 纹理链接</a>}
        </div>
      </div>
    </div>
  )
}
