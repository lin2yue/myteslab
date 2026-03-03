import { NextResponse } from 'next/server';
import { getActivityEntrySummary } from '@/lib/activity-hub';

export async function GET() {
    try {
        const summary = await getActivityEntrySummary();
        return NextResponse.json(summary, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal error';
        console.error('[activities summary] GET failed:', error);
        return NextResponse.json(
            { visible: false, href: '/activities', activityId: null, label: '活动', badge: null, title: '活动中心', error: message },
            { status: 500 }
        );
    }
}
