import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const envelope = await req.text();
        const pieces = envelope.split('\n');
        const header = JSON.parse(pieces[0]);
        const { dsn } = header;

        if (!dsn || !dsn.includes('o4511036158640128')) {
            return NextResponse.json({ error: 'Invalid DSN' }, { status: 400 });
        }

        const project_id = dsn.split('/').pop();
        const sentryHost = dsn.split('@')[1].split('/')[0];
        const url = \`https://\${sentryHost}/api/\${project_id}/envelope/\`;

        // 通过代理中转（如果需要的话，这里可以加上 fetch 代理配置）
        const response = await fetch(url, {
            method: 'POST',
            body: envelope,
            headers: {
                'Content-Type': 'application/x-sentry-envelope',
            },
        });

        return new NextResponse(response.body, {
            status: response.status,
            headers: response.headers,
        });
    } catch (e) {
        return NextResponse.json({ error: 'Tunnel error' }, { status: 500 });
    }
}
