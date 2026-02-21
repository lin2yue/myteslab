import { dbQuery } from '@/lib/db';
import { sendMPTemplateMessage } from '@/lib/wechat-mp';

interface RewardWechatNotifyParams {
    userId: string;
    rewardCredits: number;
    milestoneDownloads: number;
    wrapName?: string | null;
}

interface TopUpWechatNotifyParams {
    userId: string;
    creditsAdded: number;
    category: string;
    projectName: string;
}

export interface RewardWechatNotifyResult {
    attempted: boolean;
    success: boolean;
    reason?: string;
    errcode?: number;
    error?: string;
}

const DEFAULT_REWARD_TEMPLATE_ID = 'OvZNfxr9f-Ws2CjtrTmxUy8rXb4mtY4V_kyywd26Tvw';

function toThing(value: string, maxLen = 20) {
    const text = (value || '').trim();
    if (!text) return '-';
    return text.length > maxLen ? `${text.slice(0, Math.max(0, maxLen - 1))}…` : text;
}

export async function notifyUserCreditRewardByWechat(params: RewardWechatNotifyParams): Promise<RewardWechatNotifyResult> {
    const templateId = process.env.WECHAT_MP_CREDIT_REWARD_TEMPLATE_ID || DEFAULT_REWARD_TEMPLATE_ID;

    const recipientRows = await getWechatRecipientData(params.userId);
    const recipient = recipientRows[0];
    const openId = recipient?.openid_mp;
    if (!openId) {
        console.info(`[UserRewardNotify] Skip: user ${params.userId} has no MP openid`);
        return { attempted: false, success: false, reason: 'no_openid_mp' };
    }

    const rawName = recipient?.display_name?.trim() || '';
    const emailPrefix = (recipient?.email || '').split('@')[0] || '';
    const accountName = toThing(rawName || emailPrefix || `U${params.userId.replace(/-/g, '').slice(0, 12)}`, 20);
    const balance = Number(recipient?.balance || 0);
    const wrapText = toThing(params.wrapName?.trim() || '下载里程碑奖励作品');

    const result = await sendMPTemplateMessage({
        touser: openId,
        template_id: templateId,
        data: {
            thing3: { value: accountName },
            thing4: { value: '下载里程碑奖励' },
            thing16: { value: wrapText },
            character_string20: { value: String(Math.max(0, Math.floor(params.rewardCredits))) },
            amount6: { value: `${balance}` }
        }
    });

    if (!result.success) {
        console.error('[UserRewardNotify] Template send failed:', result.error);
        return {
            attempted: true,
            success: false,
            errcode: result.errcode,
            error: result.error
        };
    }

    return { attempted: true, success: true };
}

export async function notifyUserTopUpByWechat(params: TopUpWechatNotifyParams): Promise<RewardWechatNotifyResult> {
    const templateId = process.env.WECHAT_MP_CREDIT_REWARD_TEMPLATE_ID || DEFAULT_REWARD_TEMPLATE_ID;
    const recipient = await getWechatRecipientData(params.userId);
    const row = recipient[0];
    const openId = row?.openid_mp;
    if (!openId) {
        console.info(`[UserTopUpNotify] Skip: user ${params.userId} has no MP openid`);
        return { attempted: false, success: false, reason: 'no_openid_mp' };
    }

    const rawName = row?.display_name?.trim() || '';
    const emailPrefix = (row?.email || '').split('@')[0] || '';
    const accountName = toThing(rawName || emailPrefix || `U${params.userId.replace(/-/g, '').slice(0, 12)}`, 20);
    const balance = Number(row?.balance || 0);

    const result = await sendMPTemplateMessage({
        touser: openId,
        template_id: templateId,
        data: {
            thing3: { value: accountName },
            thing4: { value: toThing(params.category || '积分充值', 20) },
            thing16: { value: toThing(params.projectName || '积分充值', 20) },
            character_string20: { value: String(Math.max(0, Math.floor(params.creditsAdded))) },
            amount6: { value: `${balance}` }
        }
    });

    if (!result.success) {
        console.error('[UserTopUpNotify] Template send failed:', result.error);
        return {
            attempted: true,
            success: false,
            errcode: result.errcode,
            error: result.error
        };
    }

    return { attempted: true, success: true };
}

async function getWechatRecipientData(userId: string) {
    const { rows } = await dbQuery<{
        openid_mp: string | null;
        display_name: string | null;
        email: string | null;
        balance: number | null;
    }>(
        `SELECT
            ui.openid_mp,
            p.display_name,
            p.email,
            uc.balance
         FROM profiles p
         LEFT JOIN user_identities ui
            ON ui.user_id = p.id
           AND ui.provider = 'wechat'
           AND ui.openid_mp IS NOT NULL
         LEFT JOIN user_credits uc
            ON uc.user_id = p.id
         WHERE p.id = $1
         ORDER BY ui.created_at DESC NULLS LAST
         LIMIT 1`,
        [userId]
    );
    return rows;
}
