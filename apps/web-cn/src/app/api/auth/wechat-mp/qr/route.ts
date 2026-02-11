import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const ticket = searchParams.get('ticket');

    if (!ticket) {
        return NextResponse.json({ success: false, error: 'Missing ticket' }, { status: 400 });
    }

    try {
        const upstreamUrl = `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(ticket)}`;
        const upstreamResponse = await fetch(upstreamUrl, {
            cache: 'no-store',
            headers: {
                Accept: 'image/*',
            },
        });

        if (!upstreamResponse.ok) {
            return NextResponse.json(
                { success: false, error: 'Failed to load QR image' },
                { status: upstreamResponse.status }
            );
        }

        const contentType = upstreamResponse.headers.get('content-type') || 'image/jpeg';
        const imageBuffer = Buffer.from(await upstreamResponse.arrayBuffer());

        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
            },
        });
    } catch (error) {
        console.error('[wechat-mp] Failed to proxy QR image', error);
        return NextResponse.json({ success: false, error: 'Failed to proxy QR image' }, { status: 500 });
    }
}
