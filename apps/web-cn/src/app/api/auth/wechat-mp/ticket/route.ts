
import { NextResponse } from 'next/server';
import { createQRScene } from '@/lib/wechat-mp';
import { dbQuery } from '@/lib/db';

export async function POST() {
    try {
        // 1. 生成场景 ID (scene_id)
        const sceneId = crypto.randomUUID();

        // 2. 调用微信 API 获取 Ticket
        const { ticket, qrUrl } = await createQRScene(sceneId);

        // 3. 将会话信息存入数据库
        await dbQuery(
            `INSERT INTO wechat_qr_sessions (scene_id, ticket, status, expires_at) 
             VALUES ($1, $2, 'PENDING', NOW() + INTERVAL '10 minutes')`,
            [sceneId, ticket]
        );

        return NextResponse.json({
            success: true,
            sceneId,
            qrUrl,
        });
    } catch (error: any) {
        console.error('[wechat-mp] Failed to generate ticket', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to generate QR code',
        }, { status: 500 });
    }
}
