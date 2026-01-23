import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    console.log('[OAuth Callback] Received request');
    console.log('[OAuth Callback] code:', code ? 'present' : 'missing');
    console.log('[OAuth Callback] next param:', next);
    console.log('[OAuth Callback] full URL:', request.url);

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            console.log('[OAuth Callback] Session exchange successful, redirecting to:', `${origin}${next}`);
            return NextResponse.redirect(`${origin}${next}`);
        } else {
            console.error('[OAuth Callback] Session exchange failed:', error);
        }
    }

    console.log('[OAuth Callback] No code or error, redirecting to login with error');
    return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}
