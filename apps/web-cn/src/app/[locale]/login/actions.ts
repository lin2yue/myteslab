'use server';

import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { createUser, getUserByEmail } from '@/lib/auth/users';

export async function login(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    if (!email || !password) {
        return { success: false, error: 'Invalid credentials' };
    }

    const user = await getUserByEmail(email);
    if (!user || !user.password_hash) {
        return { success: false, error: 'Invalid login credentials' };
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
        return { success: false, error: 'Invalid login credentials' };
    }

    await createSession(user.id);
    return { success: true };
}

export async function signup(formData: FormData, nextUrl?: string) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    if (!email || !password) {
        return { success: false, error: 'Invalid credentials' };
    }

    const existing = await getUserByEmail(email);
    if (existing) {
        return { success: false, error: 'User already exists' };
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
        email,
        passwordHash,
        displayName: email.split('@')[0],
    });

    if (!user) {
        return { success: false, error: 'Signup failed' };
    }

    await createSession(user.id);
    return { success: true };
}

export async function resetPassword(email: string) {
    console.warn('[resetPassword] Not implemented for RDS auth yet:', email);
    return { success: false, error: '暂不支持找回密码' };
}

export async function resendVerification(email: string) {
    console.warn('[resendVerification] Not implemented for RDS auth yet:', email);
    return { success: false, error: '暂不支持邮箱验证' };
}
