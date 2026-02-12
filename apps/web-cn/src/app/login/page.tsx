import { Metadata } from 'next';
import LoginForm from './LoginForm';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { normalizeNextPath } from '@/lib/auth/redirect';

export const metadata: Metadata = {
    title: 'Sign In - 特玩',
    robots: {
        index: false,
    },
};

type LoginPageProps = {
    searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const user = await getSessionUser();

    if (user) {
        const { next } = await searchParams;
        redirect(normalizeNextPath(next, '/'));
    }

    return (
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-transparent py-12 px-4 sm:px-6 lg:px-8">
            <LoginForm />
        </div>
    );
}
