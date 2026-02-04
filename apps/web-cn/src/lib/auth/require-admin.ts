import { getSessionUser } from '@/lib/auth/session';

export async function requireAdmin() {
    const user = await getSessionUser();
    if (!user) return null;
    const role = user.role || 'user';
    if (role !== 'admin' && role !== 'super_admin') return null;
    return user;
}

