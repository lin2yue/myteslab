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

  const handleExportTexture = () => {
    if (!textureDataUrl) return
    downloadDataUrl(textureDataUrl, `tewan-texture-${selectedModel.slug}-${Date.now()}.png`)
  }

  const handleSaveDraft = () => {
    if (!textureDataUrl) return
    localStorage.setItem(DRAFT_TEXTURE_KEY, textureDataUrl)
  }

  const handleLoadDraft = () => {
    const draft = localStorage.getItem(DRAFT_TEXTURE_KEY)
    if (!draft) return
    setTextureDataUrl(draft)
  }

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

  const handleSaveProject = () => {
    const payload = buildProjectEnvelope()
    if (!payload) return

    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(payload))
    downloadJson(payload, `tewan-editor-project-${Date.now()}.json`)
  }

  const hydrateProject = async (parsed: ProjectEnvelope) => {
    if (parsed.modelSlug) setSelectedModelSlug(parsed.modelSlug)
    if (parsed.textureDataUrl) setTextureDataUrl(parsed.textureDataUrl)
    if (parsed.textureOssUrl) setOssTextureUrl(parsed.textureOssUrl)
    if (parsed.project && canvasEditorRef.current) {
      await canvasEditorRef.current.importProject(parsed.project)
    }
  }

  const handleLoadProject = async () => {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as ProjectEnvelope
    await hydrateProject(parsed)
  }

  const handleImportProjectFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as ProjectEnvelope
      await hydrateProject(parsed)
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(parsed))
    } catch (error) {
      console.error('[Tewan3DEditor] Import project failed:', error)
      alert('工程文件解析失败，请检查 JSON 格式')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const handleUploadTextureToOSS = async () => {
    if (!textureDataUrl) return

    setUploadingTexture(true)
    try {
      const signRes = await fetch('/api/editor/get-texture-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
      const signData = await signRes.json()
      if (!signData.success) throw new Error(signData.error || '签名失败')

      const blob = await dataUrlToBlob(textureDataUrl)
      const uploadRes = await fetch(signData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: blob
      })

      if (!uploadRes.ok) {
        const txt = await uploadRes.text().catch(() => '')
        throw new Error(`上传失败: ${uploadRes.status} ${txt}`)
      }

      setOssTextureUrl(signData.publicUrl ?? signData.ossKey)
    } catch (error) {
      console.error('[Tewan3DEditor] Upload texture failed:', error)
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
      const signRes = await fetch('/api/editor/get-project-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
      const signData = await signRes.json()
      if (!signData.success) throw new Error(signData.error || '签名失败')

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const uploadRes = await fetch(signData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: blob
      })

      if (!uploadRes.ok) {
        const txt = await uploadRes.text().catch(() => '')
        throw new Error(`上传失败: ${uploadRes.status} ${txt}`)
      }

      alert(`工程快照已上传：${signData.publicUrl ?? signData.ossKey}`)
    } catch (error) {
      console.error('[Tewan3DEditor] Upload project snapshot failed:', error)
      alert('上传工程快照失败')
    } finally {
      setUploadingProject(false)
    }
  }

  const included = materialDecisions.filter((d) => d.decision === 'included')
  const excluded = materialDecisions.filter((d) => d.decision === 'excluded')

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6 text-white">
      <div>
        <h1 className="text-2xl font-bold">Tewan 3D 高级编辑器（Final M1）</h1>
        <p className="mt-1 text-sm text-gray-400">M1.3：材质映射调试、工程文件导入导出、OSS 纹理与工程快照上传已打通</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 p-3 text-sm">
        <label className="text-gray-300">车型</label>
        <select
          className="rounded bg-gray-800 px-3 py-1.5"
          value={selectedModelSlug}
          onChange={(e) => setSelectedModelSlug(e.target.value)}
        >
          {DEFAULT_MODELS.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>

        <button className="rounded bg-indigo-600 px-3 py-1.5" onClick={handleExportTexture} disabled={!textureDataUrl}>
          导出纹理 PNG
        </button>
        <button className="rounded bg-gray-700 px-3 py-1.5" onClick={handleSaveDraft} disabled={!textureDataUrl}>
          保存纹理草稿
        </button>
        <button className="rounded bg-gray-700 px-3 py-1.5" onClick={handleLoadDraft}>
          读取纹理草稿
        </button>

        <button className="rounded bg-teal-700 px-3 py-1.5" onClick={handleSaveProject}>
          导出完整工程 JSON
        </button>
        <button className="rounded bg-teal-700 px-3 py-1.5" onClick={handleLoadProject}>
          读取本地工程
        </button>
        <button className="rounded bg-teal-700 px-3 py-1.5" onClick={() => importInputRef.current?.click()}>
          导入工程文件
        </button>
        <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportProjectFile} />

        <button
          className="rounded bg-emerald-700 px-3 py-1.5"
          onClick={handleUploadTextureToOSS}
          disabled={!textureDataUrl || uploadingTexture}
        >
          {uploadingTexture ? '上传中…' : '上传纹理到 OSS'}
        </button>

        <button className="rounded bg-cyan-700 px-3 py-1.5" onClick={handleUploadProjectSnapshot} disabled={uploadingProject}>
          {uploadingProject ? '上传中…' : '上传工程快照到 OSS'}
        </button>
      </div>

      {ossTextureUrl && (
        <div className="rounded border border-emerald-800 bg-emerald-950/40 p-3 text-xs text-emerald-200">
          纹理已上传：
          <a href={ossTextureUrl} target="_blank" className="ml-1 underline" rel="noreferrer">
            {ossTextureUrl}
          </a>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[540px_1fr]">
        <Canvas2DEditor ref={canvasEditorRef} />
        <CarPreview3D
          modelUrl={selectedModel.model_3d_url}
          modelSlug={selectedModel.slug}
          textureDataUrl={textureDataUrl}
          onMaterialDecisions={setMaterialDecisions}
        />
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-xs">
        <p className="mb-2 font-semibold">材质映射调试面板</p>
        <p className="text-gray-300">命中（会贴图）: {included.length} ｜ 排除（不贴图）: {excluded.length}</p>
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          <div className="rounded border border-emerald-900 bg-black/30 p-2">
            <p className="mb-1 text-emerald-300">Included</p>
            <div className="max-h-44 overflow-auto space-y-1">
              {included.slice(0, 50).map((d, idx) => (
                <div key={`i-${idx}`} className="text-emerald-200">{d.meshName || '(mesh)'} / {d.materialName || '(material)'} · {d.reason}</div>
              ))}
            </div>
          </div>
          <div className="rounded border border-rose-900 bg-black/30 p-2">
            <p className="mb-1 text-rose-300">Excluded</p>
            <div className="max-h-44 overflow-auto space-y-1">
              {excluded.slice(0, 50).map((d, idx) => (
                <div key={`e-${idx}`} className="text-rose-200">{d.meshName || '(mesh)'} / {d.materialName || '(material)'} · {d.reason}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
