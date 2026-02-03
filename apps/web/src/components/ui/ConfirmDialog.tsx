'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import Portal from '@/components/Portal'
import Button from './Button'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description?: string
  confirmText: string
  cancelText: string
  isDanger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText,
  cancelText,
  isDanger = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

        <div className="relative w-full max-w-md bg-white/90 dark:bg-zinc-900/80 rounded-2xl border border-black/5 dark:border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-6 backdrop-blur">
          <button
            onClick={onCancel}
            className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-black/5"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            {description && (
              <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">{description}</p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button
              size="sm"
              className={isDanger ? 'bg-red-600 hover:bg-red-700 shadow-none' : ''}
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
