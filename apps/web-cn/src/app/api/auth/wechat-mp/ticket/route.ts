
import { NextResponse } from 'next/server';
import { createQRScene } from '@/lib/wechat-mp';
import { dbQuery } from '@/lib/db';

export async function POST() {
    try {
        // 1. 创建场景 ID (scene_id)
        // 数据库已经有了 wechat_qr_sessions 表，scene_id 是 UUID
        const { rows } = await dbQuery(
            `INSERT INTO wechat_qr_sessions (status, expires_at) 
             VALUES ('PENDING', NOW() + INTERVAL '10 minutes') 
             RETURNING scene_id`
        );
        const sceneId = rows[0].scene_id;

        // 2. 调用微信 API 获取 Ticket
        const { ticket, qrUrl } = await createQRScene(sceneId);

        // 3. 更新 Ticket 到数据库
        await dbQuery(
            `UPDATE wechat_qr_sessions SET ticket = $1 WHERE scene_id = $2`,
            [ticket, sceneId]
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
