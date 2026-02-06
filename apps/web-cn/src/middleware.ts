import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

export default async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const isApiRoute = pathname.startsWith('/api/');

    // Admin Protection (route check)
    const isAdminRoute = pathname.startsWith('/admin');
    const isProfileRoute = pathname.startsWith('/profile');
    const isCheckoutRoute = pathname.startsWith('/checkout');
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth');

    if (isApiRoute) {
        return NextResponse.next();
    }

    const hasAuthCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if ((isAdminRoute || isProfileRoute || isCheckoutRoute) && !hasAuthCookie) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
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
         * - baidu_verify_*.html (Baidu webmaster verification)
         * - models/ (3D models)
         * - textures/ (static textures)
         * - assets/ (shared assets)
         * - Any file with a common extension (images, fonts, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|sitemap.*|robots\\.txt|MP_verify_.*\\.txt|baidu_verify_.*\\.html|models/|textures/|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf|woff2?|ttf|eot)$).*)',
    ],
};
