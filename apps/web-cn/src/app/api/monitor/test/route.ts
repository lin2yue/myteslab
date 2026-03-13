import { NextResponse } from 'next/server';
import { reportError } from '@/lib/monitor';

export async function GET() {
    await reportError({
        error: 'Guardian Test Alert',
        level: 'info',
        context: {
            message: '这是一条来自 Guardian 系统的自动测试告警',
            foo: 'bar'
        }
    });
    return NextResponse.json({ success: true, message: 'Test alert sent' });
}
