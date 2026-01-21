'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteGeneratedWrap(wrapId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Unauthorized')
    }

    // Soft delete: set deleted_at to NOW and unpublish
    const { error } = await supabase
        .from('generated_wraps')
        .update({
            deleted_at: new Date().toISOString(),
            is_public: false
        })
        .eq('id', wrapId)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error deleting wrap:', error)
        throw new Error(error.message)
    }

    revalidatePath('/[locale]/profile', 'page')
}

export async function updateWrapVisibility(wrapId: string, isPublic: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Unauthorized')
    }

    const { error } = await supabase
        .from('generated_wraps')
        .update({ is_public: isPublic })
        .eq('id', wrapId)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error updating wrap visibility:', error)
        throw new Error(error.message)
    }

    revalidatePath('/[locale]/profile', 'page')
}
