import { createClient } from '@/utils/supabase/server';

export type AdminIdentity = {
    id: string;
    role: 'admin' | 'super_admin';
    email: string | null;
};

export async function requireAdmin(): Promise<AdminIdentity | null> {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        return null;
    }

    const role = profile.role as string | null;
    if (role !== 'admin' && role !== 'super_admin') {
        return null;
    }

    return {
        id: user.id,
        role,
        email: (user.email || profile.email || null) as string | null,
    };
}
