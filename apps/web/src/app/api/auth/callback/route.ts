import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as EmailOtpType | null;
    const next = searchParams.get('next') ?? '/';

    console.log('[Auth Callback] Received request');
    console.log('[Auth Callback] code:', code ? 'present' : 'missing');
    console.log('[Auth Callback] token_hash:', token_hash ? 'present' : 'missing');
    console.log('[Auth Callback] type:', type);
    console.log('[Auth Callback] next param:', next);
    console.log('[Auth Callback] full URL:', request.url);

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            console.log('[Auth Callback] Session exchange successful (code), redirecting to:', `${origin}${next}`);
            return NextResponse.redirect(`${origin}${next}`);
        } else {
            console.error('[Auth Callback] Session exchange failed (code):', error);
        }
    }

    if (token_hash && type) {
        console.log('[Auth Callback] Attempting to verify OTP with token_hash');
        const supabase = await createClient();
        const { data, error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        });
        if (!error) {
            console.log('[Auth Callback] OTP verification successful (token_hash)');
            console.log('[Auth Callback] User ID:', data.user?.id);
            console.log('[Auth Callback] Session exists:', !!data.session);
            console.log('[Auth Callback] Redirecting to:', `${origin}${next}`);
            return NextResponse.redirect(`${origin}${next}`);
        } else {
            console.error('[Auth Callback] OTP verification failed (token_hash):', error);
            // Fallthrough to error redirect
        }
    }

    console.log('[Auth Callback] No valid code/token or error, redirecting to login with error');
    return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}
