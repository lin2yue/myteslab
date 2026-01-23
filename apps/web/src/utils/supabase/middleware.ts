import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // Check if this is an OAuth callback with a code
    const code = request.nextUrl.searchParams.get('code')
    if (code) {
        console.log('[updateSession] Detected OAuth code, exchanging for session')
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
            console.error('[updateSession] Failed to exchange code for session:', error)
        } else {
            console.log('[updateSession] Successfully exchanged code for session')
        }
    }

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake can make it very hard to debug
    // issues with users or sessions.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    return supabaseResponse
}
