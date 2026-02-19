import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { pathname, referrer } = body;
        
        if (!pathname) {
            return NextResponse.json({ error: 'Pathname is required' }, { status: 400 });
        }

        const user = await getSessionUser();
        const userAgent = req.headers.get('user-agent') || 'unknown';
        const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown';

        await dbQuery(
            `INSERT INTO site_analytics (user_id, pathname, referrer, user_agent, ip_address)
             VALUES ($1, $2, $3, $4, $5)`,
            [user?.id || null, pathname, referrer || null, userAgent, ipAddress]
        );

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: any) {
        console.error('[Analytics API Error]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
