import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const hasAuthCookie = request.cookies.getAll().some(({ name }) => {
        if (name === 'supabase-auth-token') return true
        if (!name.startsWith('sb-')) return false
        return name.includes('auth-token') || name.includes('refresh-token') || name.includes('access-token')
    })

    // Skip touching Supabase if there's no auth cookie (public traffic)
    if (!hasAuthCookie) {
        return supabaseResponse
    }



    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseKey) {
        console.error(`[MIDDLEWARE] Missing Supabase EnvVars! URL: ${!!supabaseUrl}, Key: ${!!supabaseKey}`);
        // Do not throw in middleware to avoid crashing the whole site
        // But auth will fail
    }

    const supabase = createServerClient(
        supabaseUrl || '',
        supabaseKey || '',
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake can make it very hard to debug
    // issues with users or sessions.

    const isDev = process.env.NODE_ENV === 'development'
    if (isDev) {
        console.log('[Middleware] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'PRESENT' : 'MISSING');
    }

    try {
        const {
            data: { user },
            error
        } = await supabase.auth.getUser()
        if (error) console.error('[Middleware] getUser error:', error.message);
        else if (isDev) console.log('[Middleware] getUser success');
    } catch (e: any) {
        console.error('[Middleware] getUser exception:', e.message);
    }

    return supabaseResponse
}
