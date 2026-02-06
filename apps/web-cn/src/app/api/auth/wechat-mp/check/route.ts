
import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { createSession } from '@/lib/auth/session';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sceneId = searchParams.get('sceneId');

    if (!sceneId) {
        return NextResponse.json({ success: false, error: 'Missing sceneId' }, { status: 400 });
    }

    try {
        const { rows } = await dbQuery(
            `SELECT status, user_id FROM wechat_qr_sessions WHERE scene_id = $1`,
            [sceneId]
        );

        if (rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Invalid scene' }, { status: 404 });
        }

        const session = rows[0];

        if (session.status === 'COMPLETED' && session.user_id) {
            // 登录成功，创建 Session
            await createSession(session.user_id);

            // 清理场景 (可选，或保留一段时间供审计)
            // await dbQuery('DELETE FROM wechat_qr_sessions WHERE scene_id = $1', [sceneId]);

            return NextResponse.json({
                success: true,
                status: 'COMPLETED',
            });
        }

        return NextResponse.json({
            success: true,
            status: session.status,
        });
    } catch (error) {
        console.error('[wechat-mp] Check status error', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
