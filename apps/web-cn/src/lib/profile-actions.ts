'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
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

export async function updateWrapTitle(wrapId: string, title: string) {
    const user = await getSessionUser()
    if (!user) {
        throw new Error('Unauthorized')
    }

    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
        throw new Error('Title is required')
    }
    if (normalizedTitle.length > 200) {
        throw new Error('Title is too long')
    }

    const { rows, rowCount } = await dbQuery<{ name: string }>(
        `UPDATE wraps
         SET name = $3, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
         RETURNING name`,
        [wrapId, user.id, normalizedTitle]
    )

    if (!rowCount) {
        throw new Error('Wrap not found')
    }

    revalidatePath('/profile', 'page')
    revalidateTag('wraps', 'default')

    return rows[0]?.name || normalizedTitle
}
