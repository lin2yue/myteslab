import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import { getSessionUser } from '@/lib/auth/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();
    if (!user) {
        redirect('/login?next=/admin');
    }
    if (user.role !== 'admin' && user.role !== 'super_admin') {
        redirect('/');
    }
    return <AdminShell>{children}</AdminShell>;
}
