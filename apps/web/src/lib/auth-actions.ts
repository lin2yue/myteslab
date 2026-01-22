'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';

/**
 * Permanently delete the user's own account.
 */
export async function deleteUserAccount() {
    const supabase = await createClient();

    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new Error('Unauthorized');
    }

    const userId = user.id;
    const adminClient = createAdminClient();

    // 2. Delete user using admin client (Service Role)
    // Cascading deletes in DB should clean up profiles, user_credits, wraps, etc.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
        console.error('Error deleting user account:', deleteError);
        throw new Error('Failed to delete account');
    }

    // 3. Sign out the user (clears session cookies)
    await supabase.auth.signOut();

    // 4. Redirect to home page
    redirect('/');
}
