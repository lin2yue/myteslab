'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/routing';
import { getLocale } from 'next-intl/server';

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
        redirect({ href: '/login?error=Could not authenticate user', locale });
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

    const { error } = await supabase.auth.signUp({
        ...data,
        options: {
            data: {
                locale,
            },
        },
    });

    console.log('[Signup] Locale:', locale);
    console.log('[Signup] Email:', data.email);

    if (error) {
        console.error('[Signup] Error:', error);
        redirect({ href: '/login?error=Could not authenticate user', locale });
    }

    // Signup successful, redirect to login with success message
    redirect({ href: '/login?success=check_email', locale });
}
