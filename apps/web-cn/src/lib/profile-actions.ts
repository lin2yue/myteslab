'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth/session'
import { dbQuery } from '@/lib/db'

export async function deleteGeneratedWrap(wrapId: string) {
    const user = await getSessionUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    // Soft delete: set deleted_at to NOW and unpublish
    await dbQuery(
        `UPDATE wraps
         SET deleted_at = NOW(), is_public = false, updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [wrapId, user.id]
    )

    revalidatePath('/profile', 'page')
}

export async function updateWrapVisibility(wrapId: string, isPublic: boolean) {
    const user = await getSessionUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    await dbQuery(
        `UPDATE wraps
         SET is_public = $3, updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [wrapId, user.id, isPublic]
    )

    revalidatePath('/profile', 'page')
}
