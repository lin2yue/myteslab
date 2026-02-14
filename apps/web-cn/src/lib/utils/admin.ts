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
    const adminOpenId = process.env.WECHAT_MP_ADMIN_OPENID;
    const templateId = process.env.WECHAT_MP_NEW_USER_TEMPLATE_ID;

    if (!adminOpenId || !templateId) {
        console.warn('[AdminNotify] WECHAT_MP_ADMIN_OPENID or WECHAT_MP_NEW_USER_TEMPLATE_ID not configured');
        return;
    }

    try {
        const metadataString = Object.entries(payload.metadata || {})
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        const result = await sendMPTemplateMessage({
            touser: adminOpenId,
            template_id: templateId,
            data: {
                first: { value: payload.title, color: '#173177' },
                keyword1: { value: payload.message },
                keyword2: { value: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) },
                remark: { value: metadataString }
            }
        });

        if (!result.success) {
            console.error('[AdminNotify] WeChat notification failed:', result.error);
        }
    } catch (error) {
        console.error('[AdminNotify] Error sending WeChat notification:', error);
    }
}

/**
 * General admin notification entry point
 */
export async function notifyAdmin(payload: NotificationPayload) {
    // Only WeChat as requested by user
    if (process.env.WECHAT_MP_ADMIN_OPENID && process.env.WECHAT_MP_NEW_USER_TEMPLATE_ID) {
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
