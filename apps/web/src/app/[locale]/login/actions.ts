'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/routing';
import { getLocale } from 'next-intl/server';
import { headers } from 'next/headers';

import { createClient } from '@/utils/supabase/server';

export async function login(formData: FormData) {
    const locale = await getLocale();
    const supabase = await createClient();

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    };

    const { error } = await supabase.auth.signInWithPassword(data);

    if (error) {
        console.error('[Login] Error:', error.message);
        redirect({ href: `/login?error=${encodeURIComponent(error.message)}`, locale });
    }

    revalidatePath('/', 'layout');
    redirect({ href: '/', locale });
}

export async function signup(formData: FormData) {
    const locale = await getLocale();
    const supabase = await createClient();

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    };

    const headersList = await headers();
    const host = headersList.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${host}`;
    const redirectTo = `${origin}/api/auth/callback?next=/${locale}`;

    const { error } = await supabase.auth.signUp({
        ...data,
        options: {
            emailRedirectTo: redirectTo,
            data: {
                locale,
            },
        },
    });

    console.log('[Signup] Locale:', locale);
    console.log('[Signup] Email:', data.email);

    if (error) {
        console.error('[Signup] Error:', error.message);
        redirect({ href: `/login?error=${encodeURIComponent(error.message)}`, locale });
    }

    // Signup successful, redirect to login with success message
    redirect({ href: '/login?success=check_email', locale });
}
