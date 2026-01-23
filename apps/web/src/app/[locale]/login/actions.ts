'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/routing';
import { getLocale } from 'next-intl/server';
import { headers } from 'next/headers';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function checkUserExists(email: string) {
    try {
        // Use regular client to query users table via RPC or public schema
        // Since auth.users is not directly accessible, we'll use a different approach
        const supabase = await createClient();

        // Try to sign in with a dummy password to check if user exists
        // This is a workaround since we can't query auth.users directly
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: '__dummy_password_to_check_existence__'
        });

        // If we get "Invalid login credentials", user exists but password is wrong
        // If we get "Email not confirmed", user exists but hasn't confirmed
        // If we get other errors, we need to check the message

        if (error) {
            if (error.message === 'Invalid login credentials') {
                // User exists, password is wrong - they should login
                return { exists: true, confirmed: true };
            } else if (error.message === 'Email not confirmed') {
                // User exists but hasn't confirmed email
                return { exists: true, confirmed: false };
            } else if (error.message.includes('User not found') || error.message.includes('not found')) {
                // User doesn't exist
                return { exists: false, confirmed: false };
            } else {
                // Unknown error, log it
                console.error('[checkUserExists] Unexpected error:', error.message);
                // Assume user doesn't exist to allow signup
                return { exists: false, confirmed: false };
            }
        }

        // If no error, user successfully logged in (shouldn't happen with dummy password)
        // Sign them out immediately
        await supabase.auth.signOut();
        return { exists: true, confirmed: true };

    } catch (err) {
        console.error('[checkUserExists] Unexpected error:', err);
        return { exists: false, confirmed: false };
    }
}

export async function login(formData: FormData) {
    const locale = await getLocale();
    const supabase = await createClient();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error('[Login] Error:', error.message);
        return { success: false, error: error.message };
    }

    revalidatePath('/', 'layout');
    // 返回成功状态,让客户端处理重定向
    return { success: true };
}

export async function signup(formData: FormData, nextUrl?: string) {
    const locale = await getLocale();
    const supabase = await createClient();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const headersList = await headers();
    const host = headersList.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${host}`;
    const redirectTo = `${origin}/api/auth/callback?next=${nextUrl || '/' + locale}`;

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: redirectTo,
            data: {
                locale,
            },
        },
    });

    if (error) {
        console.error('[Signup] Error:', error.message);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function resetPassword(email: string) {
    const locale = await getLocale();
    const supabase = await createClient();

    const headersList = await headers();
    const host = headersList.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${host}`;
    const redirectTo = `${origin}/api/auth/callback?next=/${locale}/profile`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
    });

    if (error) {
        console.error('[resetPassword] Error:', error.message);
        return { success: false, error: error.message };
    }

    return { success: true };
}

export async function resendVerification(email: string) {
    const locale = await getLocale();
    const supabase = await createClient();

    const headersList = await headers();
    const host = headersList.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${host}`;
    const redirectTo = `${origin}/api/auth/callback?next=/${locale}`;

    const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
            emailRedirectTo: redirectTo,
        },
    });

    if (error) {
        console.error('[resendVerification] Error:', error.message);
        return { success: false, error: error.message };
    }

    return { success: true };
}
