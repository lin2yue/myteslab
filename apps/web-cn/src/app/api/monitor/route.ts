import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { error, stack, context, level = 'error' } = body;

        const alertMessage = {
            project: 'tewan-web-cn',
            timestamp: new Date().toISOString(),
            level,
            error: error || 'Unknown Error',
            stack: stack ? stack.split('\n').slice(0, 3).join('\n') : 'No stack trace',
            context: context || {}
        };

        // 核心：打印带有特殊前缀的日志，我会通过监视器捕捉它
        console.error('---GUARDIAN_EVENT_START---');
        console.error(JSON.stringify(alertMessage, null, 2));
        console.error('---GUARDIAN_EVENT_END---');

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ success: false, error: 'Monitor failed' }, { status: 500 });
    }
}
