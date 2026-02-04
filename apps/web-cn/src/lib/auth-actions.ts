'use server';

import { redirect } from 'next/navigation';
import { getSessionUser, clearSession } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';

/**
 * Permanently delete the user's own account.
 */
export async function deleteUserAccount() {
    const user = await getSessionUser();
    if (!user) {
        throw new Error('Unauthorized');
    }

    const userId = user.id;
    // 2. Delete user (cascade will remove profiles/user_credits/related rows)
    await dbQuery('DELETE FROM users WHERE id = $1', [userId]);

    // 3. Clear session cookie
    await clearSession();

    // 4. Redirect to home page
    redirect('/');
}
