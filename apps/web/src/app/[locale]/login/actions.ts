'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/routing';
import { getLocale } from 'next-intl/server';
import { headers } from 'next/headers';

import { createClient } from '@/utils/supabase/server';
// checkUserExists 已被移除，因为我们转向了更安全的 Login/Signup 分离模式
// 不再需要前端暴露用户是否存在

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

    console.log('[Signup] Generated redirectTo:', redirectTo);

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
