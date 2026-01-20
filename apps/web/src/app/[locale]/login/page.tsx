import LoginForm from './LoginForm';

export default function LoginPage() {
    return (
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gray-50 dark:bg-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
            <LoginForm />
        </div>
    );
}
