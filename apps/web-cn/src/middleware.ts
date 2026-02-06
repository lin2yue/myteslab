import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname.startsWith('/api/');

    // Admin Protection (route check)
    const isAdminRoute = pathname.match(/^\/(zh\/)?admin/) || pathname.startsWith('/admin');
    const isProfileRoute = pathname.match(/^\/(zh\/)?profile/) || pathname.startsWith('/profile');
    const isCheckoutRoute = pathname.match(/^\/(zh\/)?checkout/) || pathname.startsWith('/checkout');
    const isAuthRoute = pathname.match(/^\/(zh\/)?(login|auth)/) || pathname.startsWith('/login') || pathname.startsWith('/auth');

    const requiresAuthCheck = isApiRoute || isAdminRoute || isProfileRoute || isCheckoutRoute || isAuthRoute;

    if (isApiRoute) {
        return NextResponse.next();
    }

    if (!requiresAuthCheck) {
        const response = intlMiddleware(request);
        response.headers.set('Vary', 'Accept-Language');
        return response;
    }

    const hasAuthCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if ((isAdminRoute || isProfileRoute || isCheckoutRoute) && !hasAuthCookie) {
        const loginUrl = new URL('/zh/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
    }

    const response = intlMiddleware(request);

    // 7. Add Vary: Accept-Language header for International SEO
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
         * - MP_verify_*.txt (WeChat verification)
         * - models/ (3D models)
         * - textures/ (static textures)
         * - assets/ (shared assets)
         * - Any file with a common extension (images, fonts, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|sitemap.*|robots\\.txt|MP_verify_.*\\.txt|models/|textures/|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf|woff2?|ttf|eot)$).*)',
    ],
};
