import { type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { updateSession } from './utils/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
    // 1. First update the Supabase session
    // This will refresh the token if needed and handle cookies
    // The updateSession function returns a response with the necessary set-cookie headers
    const supabaseResponse = await updateSession(request);

    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname.startsWith('/api/');

    // If it's an API route, we just need the Supabase cookies
    if (isApiRoute) {
        return supabaseResponse;
    }

    // 2. For other routes, run intl middleware
    const response = intlMiddleware(request);

    // 3. IMPORTANT: Transfer cookies from supabaseResponse to the final response
    // Next.js middleware allows multiple Set-Cookie headers
    const supabaseCookies = supabaseResponse.cookies.getAll();
    supabaseCookies.forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, cookie);
    });

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - models (3D models)
         * - textures (static textures)
         */
        '/((?!_next/static|_next/image|favicon.ico|models|textures|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
