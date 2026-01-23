import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const next = searchParams.get('next');

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    return new Response(JSON.stringify({
        next_param: next,
        cookies: allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 50) })),
        url: request.url,
        headers: Object.fromEntries(request.headers.entries())
    }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
    });
}
