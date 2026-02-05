'use server';

import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { createUser, getUserByEmail } from '@/lib/auth/users';
import crypto from 'crypto';
import { sendActivationEmail } from '@/lib/mail/service';

export async function login(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    if (!email || !password) {
        return { success: false, error: '请输入邮箱和密码' };
    }

    const user = await getUserByEmail(email);
    if (!user || !user.password_hash) {
        return { success: false, error: '该邮箱尚未注册或密码错误' };
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
        return { success: false, error: '邮箱或密码错误' };
    }

    // 检查邮箱验证状态
    if (user.email && !user.email_verified_at) {
        return {
            success: false,
            error: '请先激活您的邮箱',
            needsVerification: true,
            email: user.email
        };
    }

    await createSession(user.id);
    return { success: true };
}

export async function signup(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    if (!email || !password) {
        return { success: false, error: '请输入邮箱和密码' };
    }

    const existing = await getUserByEmail(email);
    if (existing) {
        return { success: false, error: '该邮箱已注册' };
    }

    const passwordHash = await hashPassword(password);

    // 生成验证令牌
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await createUser({
        email,
        passwordHash,
        displayName: email.split('@')[0],
        verificationToken,
    });

    if (!user) {
        return { success: false, error: '注册失败，请稍后重试' };
    }

    // 发送激活邮件
    try {
        await sendActivationEmail(email, verificationToken);
    } catch (err) {
        console.error('[signup] Failed to send email:', err);
    }

    return {
        success: true,
        requiresVerification: true,
        message: '注册成功，请检查您的邮箱进行激活'
    };
}

export async function resetPassword(email: string) {
    console.warn('[resetPassword] Not implemented for RDS auth yet:', email);
    return { success: false, error: '暂不支持找回密码' };
}

export async function resendVerificationAction(email: string) {
    const user = await getUserByEmail(email);
    if (!user) return { success: true };
    if (user.email_verified_at) return { success: false, error: '该邮箱已验证' };

    const newToken = crypto.randomBytes(32).toString('hex');
    const { updateVerificationToken } = await import('@/lib/auth/users');
    await updateVerificationToken(user.id, newToken);
    await sendActivationEmail(email, newToken);

    return { success: true, message: '验证邮件已重发' };
}
