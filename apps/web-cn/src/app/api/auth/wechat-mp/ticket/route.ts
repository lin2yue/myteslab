
import { NextResponse } from 'next/server';
import { createQRScene, getMPOAuthQRUrl } from '@/lib/wechat-mp';
import { dbQuery } from '@/lib/db';

export async function POST() {
    try {
        // 1. 生成场景 ID (scene_id)
        const sceneId = crypto.randomUUID();

        // 2. 同时生成传统 Ticket (用于 PC 扫码关注) 和 Direct OAuth 链接 (用于直达授权)
        const { ticket, qrUrl } = await createQRScene(sceneId);
        const oauthUrl = getMPOAuthQRUrl(sceneId);

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
            oauthUrl,
        });
    } catch (error: any) {
        console.error('[wechat-mp] Failed to generate ticket', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to generate QR code',
        }, { status: 500 });
    }
}
