import { NextResponse } from 'next/server';

export async function GET() {
    if (process.env.NODE_ENV !== 'development') {
        return new Response('Forbidden', { status: 403 });
    }
    return NextResponse.json({
        time: new Date().toISOString(),
        env: {
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
            APP_URL: process.env.NEXT_PUBLIC_APP_URL,
            VERCEL_ENV: process.env.VERCEL_ENV,
            BRANCH: process.env.VERCEL_GIT_COMMIT_REF
        },
        webhook_configured: !!process.env.POLAR_WEBHOOK_SECRET
    });
}
