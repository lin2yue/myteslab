import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get('url')

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    try {
        // 验证URL是否来自允许的域名
        const allowedDomains = ['cdn.tewan.club']
        const urlObj = new URL(url)

        if (!allowedDomains.includes(urlObj.hostname)) {
            return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 })
        }

        // 获取远程文件
        const response = await fetch(url)

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch: ${response.statusText}` },
                { status: response.status }
            )
        }

        // 获取文件内容
        const buffer = await response.arrayBuffer()

        // 智能判断 Content-Type
        let contentType = response.headers.get('Content-Type');
        if (!contentType || contentType === 'application/octet-stream') {
            if (url.toLowerCase().endsWith('.png')) {
                contentType = 'image/png';
            } else if (url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg')) {
                contentType = 'image/jpeg';
            } else if (url.toLowerCase().endsWith('.webp')) {
                contentType = 'image/webp';
            } else if (url.toLowerCase().endsWith('.glb')) {
                contentType = 'model/gltf-binary';
            }
        }

        // 返回文件,设置正确的CORS头
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType || 'application/octet-stream',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        })
    } catch (error) {
        console.error('Proxy error:', error)
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
