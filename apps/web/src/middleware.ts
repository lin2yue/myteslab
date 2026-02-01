import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { updateSession } from './utils/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
    // 1. First update the Supabase session
    const supabaseResponse = await updateSession(request);

    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname.startsWith('/api/');

    // If it's an API route, we just need the Supabase cookies
    if (isApiRoute) {
        return supabaseResponse;
    }

    // 2. Check for OAuth callback (code or token_hash parameter at root path)
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');

    if ((code || token_hash) && (pathname === '/' || pathname.match(/^\/(en|zh)$/))) {
        console.log('[Middleware] Detected OAuth/Auth callback at root, redirecting to API handler');
        const next = searchParams.get('next') ?? '/';
        const callbackUrl = new URL('/api/auth/callback', request.url);

        if (code) callbackUrl.searchParams.set('code', code);
        if (token_hash) callbackUrl.searchParams.set('token_hash', token_hash);
        if (type) callbackUrl.searchParams.set('type', type);

        callbackUrl.searchParams.set('next', next);

        const redirectResponse = NextResponse.redirect(callbackUrl);

        // Transfer Supabase cookies (may contain PCKE verifier)
        const supabaseCookies = supabaseResponse.cookies.getAll();
        supabaseCookies.forEach(cookie => {
            redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
        });

        return redirectResponse;
    }

    // 3. For other routes, run intl middleware
    const response = intlMiddleware(request);

    // 4. Admin Protection
    // Check if the route is an admin route (e.g., /en/admin, /zh/admin, /admin)
    const isAdminRoute = pathname.match(/^\/(en|zh)\/admin/) || pathname.startsWith('/admin');

    if (isAdminRoute) {
        // We need a fresh client to check the user role accurately
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        const { createServerClient } = await import('@supabase/ssr');
        const supabase = createServerClient(supabaseUrl, supabaseKey, {
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => response.cookies.set(name, value))
                },
            },
        });

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // Not logged in, redirect to login
            const locale = pathname.split('/')[1] || 'en';
            const loginUrl = new URL(`/${locale}/login`, request.url);
            loginUrl.searchParams.set('next', pathname);
            return NextResponse.redirect(loginUrl);
        }

        // Check role in profiles table
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
            // Logged in but not an admin, redirect to home
            const locale = pathname.split('/')[1] || 'en';
            return NextResponse.redirect(new URL(`/${locale}`, request.url));
        }
    }

    // 5. IMPORTANT: Transfer cookies from supabaseResponse to the final response
    const supabaseCookies = supabaseResponse.cookies.getAll();
    supabaseCookies.forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, cookie);
    });

    // 6. Add Vary: Accept-Language header for International SEO
    response.headers.set('Vary', 'Accept-Language');

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - sitemap.* (sitemap files)
         * - robots.txt
         * - models/ (3D models)
         * - textures/ (static textures)
         * - assets/ (shared assets)
         * - Any file with a common extension (images, fonts, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|sitemap.*|robots\\.txt|models/|textures/|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf|woff2?|ttf|eot)$).*)',
    ],
};
