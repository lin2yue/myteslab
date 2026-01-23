'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/utils/supabase/client'
import { useAlert } from '@/components/alert/AlertProvider'

interface ProfileFormProps {
    initialDisplayName: string | null
    userId: string
}

export default function ProfileForm({ initialDisplayName, userId }: ProfileFormProps) {
    const t = useTranslations('Profile')
    const alert = useAlert()
    const [displayName, setDisplayName] = useState(initialDisplayName || '')
    const [isEditing, setIsEditing] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    const handleSave = async () => {
        setIsLoading(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ display_name: displayName, updated_at: new Date().toISOString() })
                .eq('id', userId)

            if (error) throw error
            setIsEditing(false)
            router.refresh()
        } catch (err: any) {
            alert.error(`Error: ${err.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    if (!isEditing) {
        return (
            <div>
                <p className="text-sm font-medium text-gray-500 mt-2">{t('display_name')}</p>
                <div className="flex items-center gap-4">
                    <p className="text-lg font-semibold text-gray-900">{displayName || 'N/A'}</p>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                    >
                        {t('edit') || 'Edit'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="mt-2">
            <p className="text-sm font-medium text-gray-500">{t('display_name')}</p>
            <div className="flex items-center gap-2 mt-1">
                <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                    placeholder="Enter nickname"
                />
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                    {isLoading ? '...' : (t('save') || 'Save')}
                </button>
                <button
                    onClick={() => {
                        setDisplayName(initialDisplayName || '')
                        setIsEditing(false)
                    }}
                    className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                    {t('cancel') || 'Cancel'}
                </button>
            </div>
        </div>
    )
}
