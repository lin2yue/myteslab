import { NextRequest, NextResponse } from 'next/server'

const CDN_ORIGIN = (process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club').replace(/\/+$/, '')
const ALLOWED_HOSTS = new Set([
    'cdn.tewan.club',
    'lock-sounds.oss-cn-beijing.aliyuncs.com'
])

function normalizeProxyTarget(rawUrl: string): string {
    const parsed = new URL(rawUrl)
    if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol')
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
        throw new Error('Domain not allowed')
    }

    // Always prefer CDN as final asset host to minimize CORS/config drift.
    if (parsed.hostname !== 'cdn.tewan.club') {
        return `${CDN_ORIGIN}${parsed.pathname}${parsed.search}`
    }

    return parsed.toString()
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get('url')

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    try {
        const targetUrl = normalizeProxyTarget(url)
        const redirect = NextResponse.redirect(targetUrl, 307)
        redirect.headers.set('Cache-Control', 'public, max-age=3600')
        return redirect
    } catch (error) {
        console.error('Proxy error:', error)
        if (error instanceof Error) {
            if (error.message === 'Domain not allowed') {
                return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 })
            }
            if (error.message === 'Invalid protocol' || error.message === 'Invalid URL') {
                return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 })
            }
        }
        return NextResponse.json(
            { error: 'Failed to proxy file' },
            { status: 500 }
        )
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    })
}
