'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Trash2, Globe2, GlobeLock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n'
import Portal from '@/components/Portal'
import Select from '@/components/ui/Select'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAlert } from '@/components/alert/AlertProvider'
import { deleteGeneratedWrap, updateWrapVisibility } from '@/lib/profile-actions'
import { sortModelsByPreferredOrder } from '@/lib/model-order'
import { ServiceType, getServiceCost } from '@/lib/constants/credits'

interface ModelOption {
  slug: string
  name: string
  name_en?: string
}

interface WrapDetailActionPanelProps {
  locale: string
  wrapId: string
  wrapSlugOrId: string
  sourceModelSlug: string
  sourceTextureUrl: string
  sourcePrompt?: string | null
  initialIsPublic: boolean
  isOwner: boolean
  models: ModelOption[]
}

export default function WrapDetailActionPanel({
  locale,
  wrapId,
  wrapSlugOrId,
  sourceModelSlug,
  sourceTextureUrl,
  sourcePrompt,
  initialIsPublic,
  isOwner,
  models
}: WrapDetailActionPanelProps) {
  const tCommon = useTranslations('Common')
  const tProfile = useTranslations('Profile')
  const alert = useAlert()
  const router = useRouter()
  const isEn = locale === 'en'
  const generationCost = getServiceCost(ServiceType.AI_GENERATION)

  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [isBusy, setIsBusy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  const candidateModels = useMemo(
    () => sortModelsByPreferredOrder(models).filter(model => model.slug !== sourceModelSlug),
    [models, sourceModelSlug]
  )

  const [targetModel, setTargetModel] = useState('')

  useEffect(() => {
    if (!showGenerateModal) return
    setTargetModel(candidateModels[0]?.slug || '')
  }, [showGenerateModal, candidateModels])

  const startCrossModelGeneration = () => {
    if (!targetModel || !sourceTextureUrl || !sourceModelSlug) return

    const params = new URLSearchParams({
      regenFromWrap: '1',
      sourceWrap: wrapSlugOrId,
      sourceTexture: sourceTextureUrl,
      targetModel
    })

    if (sourcePrompt?.trim()) {
      params.set('sourcePrompt', sourcePrompt.trim().slice(0, 380))
    }

    router.push(`/ai-generate/generate?${params.toString()}`)
  }

  const handleTogglePublish = async () => {
    if (!isOwner || isBusy) return
    setIsBusy(true)
    try {
      const nextVisibility = !isPublic
      await updateWrapVisibility(wrapId, nextVisibility)
      setIsPublic(nextVisibility)
      alert.success(tProfile('update_success'))
      router.refresh()
    } catch (error) {
      console.error('Failed to update wrap visibility from detail:', error)
      alert.error(tProfile('update_failed'))
    } finally {
      setIsBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!isOwner || isBusy) return
    setIsBusy(true)
    try {
      await deleteGeneratedWrap(wrapId)
      alert.success(isEn ? 'Creation deleted' : '已删除该创作')
      router.push('/profile')
      router.refresh()
    } catch (error) {
      console.error('Failed to delete wrap from detail:', error)
      alert.error(tProfile('delete_failed'))
    } finally {
      setIsBusy(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowGenerateModal(true)}
          disabled={!candidateModels.length || !sourceTextureUrl || !sourceModelSlug}
          className="w-full h-11 rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-semibold text-gray-800 dark:text-zinc-100 flex items-center justify-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          {isEn ? 'Generate for Another Model' : '生成其他车型'}
        </button>

        {isOwner && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={isBusy}
              className={`h-11 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${isPublic
                  ? 'border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 text-gray-700 dark:text-zinc-200'
                  : 'btn-primary'
                }`}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                {isPublic ? <GlobeLock className="w-4 h-4" /> : <Globe2 className="w-4 h-4" />}
                {isPublic ? tProfile('unpublish') : tProfile('publish')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isBusy}
              className="h-11 rounded-xl border border-red-200/60 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {tProfile('delete')}
            </button>
          </div>
        )}
      </div>

      {showGenerateModal && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowGenerateModal(false)} />

            <div className="relative w-full max-w-md bg-white/90 dark:bg-zinc-900/85 rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-6 backdrop-blur">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
                {isEn ? 'Generate for Another Model' : '生成其他车型'}
              </h3>

              <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                {isEn ? 'Choose the target model, then AI Design will start a new task automatically.' : '选择目标车型后，将跳转 AI 设计页并自动新增一条生成任务。'}
              </p>

              <div className="mt-4">
                <Select
                  value={targetModel}
                  options={candidateModels.map(model => ({
                    value: model.slug,
                    label: isEn ? (model.name_en || model.name) : model.name
                  }))}
                  onChange={setTargetModel}
                  placeholder={isEn ? 'Select target model' : '请选择目标车型'}
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="btn-secondary h-10 px-4 rounded-lg"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="button"
                  onClick={startCrossModelGeneration}
                  disabled={!targetModel}
                  className="btn-primary h-10 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEn ? `Start Generation (${generationCost} credits)` : `开始生成（${generationCost}积分）`}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={tProfile('delete')}
        description={tProfile('confirm_delete')}
        confirmText={tProfile('delete')}
        cancelText={tCommon('cancel')}
        isDanger
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />
    </>
  )
}
