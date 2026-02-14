import { sendMPTemplateMessage } from '@/lib/wechat-mp';

/**
 * Admin Notification Utilities
 */

export interface NotificationPayload {
    title: string;
    message: string;
    metadata?: Record<string, any>;
}

/**
 * Notify admin via WeChat Service Account Template Message
 */
export async function notifyWechat(payload: NotificationPayload) {
    const adminOpenIdEnv = process.env.WECHAT_MP_ADMIN_OPENID;
    const templateId = process.env.WECHAT_MP_NEW_USER_TEMPLATE_ID;

    if (!adminOpenIdEnv) {
        console.warn('[AdminNotify] WECHAT_MP_ADMIN_OPENID not configured');
        return;
    }

    const adminOpenIds = adminOpenIdEnv.split(',').map(id => id.trim()).filter(Boolean);

    if (adminOpenIds.length === 0) {
        console.warn('[AdminNotify] No valid admin OpenIDs found');
        return;
    }

    // Prepare content for Custom Message (fallback or primary if no template)
    const customMessageContent = `${payload.title}\n\n${payload.message}\n\n` +
        Object.entries(payload.metadata || {})
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n') +
        `\n\n🕒 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    // Prepare content for Template Message
    const metadataString = Object.entries(payload.metadata || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

    const templateData = {
        first: { value: payload.title, color: '#173177' },
        keyword1: { value: payload.message },
        keyword2: { value: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) },
        remark: { value: metadataString }
    };

    // Send to all admins
    await Promise.all(adminOpenIds.map(async (openId) => {
        try {
            // Strategy: 
            // 1. If Template ID exists, try Template Message first.
            // 2. If Template ID missing OR Template Message fails, try Custom Message.

            let sent = false;

            if (templateId) {
                const result = await sendMPTemplateMessage({
                    touser: openId,
                    template_id: templateId,
                    data: templateData
                });

                if (result.success) {
                    sent = true;
                } else {
                    console.warn(`[AdminNotify] Template message failed for ${openId}, trying custom message. Error: ${result.error}`);
                }
            }

            if (!sent) {
                // Try Custom Message (requires interaction within 48h)
                const { sendMPCustomMessage } = await import('@/lib/wechat-mp');
                const result = await sendMPCustomMessage(openId, customMessageContent);

                if (!result.success) {
                    console.error(`[AdminNotify] Custom message failed for ${openId} (User might not have interacted in 48h):`, result.error);
                } else {
                    console.log(`[AdminNotify] Sent custom message to ${openId}`);
                }
            }

        } catch (error) {
            console.error(`[AdminNotify] Error sending notification to ${openId}:`, error);
        }
    }));
}

// General admin notification entry point
export async function notifyAdmin(payload: NotificationPayload) {
    // Check if at least admin openid is configured
    if (process.env.WECHAT_MP_ADMIN_OPENID) {
        await notifyWechat(payload);
    } else {
        console.info('[AdminNotify] WeChat notification not configured. Log only:', payload);
    }
}

/**
 * Specific helper for new user notification
 */
export async function notifyAdminOfNewUser(user: { id: string; email?: string | null; displayName?: string | null }) {
    await notifyAdmin({
        title: '🆕 新用户加入通知',
        message: `有一位新用户注册了特玩 Tesla Studio`,
        metadata: {
            '用户ID': user.id,
            '用户昵称': user.displayName || '未填',
            '注册方式': user.email ? `邮箱 (${user.email})` : '微信登录'
        }
    });
}
