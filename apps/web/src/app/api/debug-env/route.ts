import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const envVars = {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: checkVar(process.env.NEXT_PUBLIC_SUPABASE_URL),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: checkVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        SUPABASE_SERVICE_ROLE_KEY: checkVar(process.env.SUPABASE_SERVICE_ROLE_KEY),
        GEMINI_API_KEY: checkVar(process.env.GEMINI_API_KEY),
        OSS_ACCESS_KEY_ID: checkVar(process.env.OSS_ACCESS_KEY_ID),
        OSS_ACCESS_KEY_SECRET: checkVar(process.env.OSS_ACCESS_KEY_SECRET),
        OSS_BUCKET: checkVar(process.env.OSS_BUCKET),
        OSS_REGION: checkVar(process.env.OSS_REGION),
    };

    return NextResponse.json({
        status: 'Environment Debug',
        timestamp: new Date().toISOString(),
        variables: envVars
    });
}

function checkVar(value: string | undefined) {
    if (!value) return '❌ MISSING';
    if (value.length < 10) return `⚠️ Too short (${value.length} chars)`;
    return `✅ Present (Starts with: ${value.substring(0, 5)}...)`;
}
