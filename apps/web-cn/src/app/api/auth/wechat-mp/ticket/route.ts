import { NextResponse } from 'next/server';
import { createQRScene } from '@/lib/wechat-mp';
import { dbQuery } from '@/lib/db';

export async function POST() {
    try {
        // 1. 生成场景 ID (scene_id)
        const sceneId = crypto.randomUUID();

        // 2. 生成传统 Ticket (用于 PC 扫码关注)
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
            // Use same-origin proxy URL to avoid external image loading issues in browsers.
            qrUrl: `/api/auth/wechat-mp/qr?ticket=${encodeURIComponent(ticket)}`,
            rawQrUrl: qrUrl,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to generate QR code';
        console.error('[wechat-mp] Failed to generate ticket', error);
        return NextResponse.json({
            success: false,
            error: message,
        }, { status: 500 });
    }
}
