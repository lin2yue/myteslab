import { dbQuery } from '@/lib/db';
import { sendMPTemplateMessage } from '@/lib/wechat-mp';

interface RewardWechatNotifyParams {
    userId: string;
    rewardCredits: number;
    milestoneDownloads: number;
    wrapName?: string | null;
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

    const [identityRes, profileRes, creditRes] = await Promise.all([
        dbQuery<{ openid_mp: string | null }>(
            `SELECT openid_mp
             FROM user_identities
             WHERE user_id = $1
               AND provider = 'wechat'
               AND openid_mp IS NOT NULL
             ORDER BY created_at DESC
             LIMIT 1`,
            [params.userId]
        ),
        dbQuery<{ display_name: string | null; email: string | null }>(
            `SELECT display_name, email
             FROM profiles
             WHERE id = $1
             LIMIT 1`,
            [params.userId]
        ),
        dbQuery<{ balance: number | null }>(
            `SELECT balance
             FROM user_credits
             WHERE user_id = $1
             LIMIT 1`,
            [params.userId]
        )
    ]);

    const openId = identityRes.rows[0]?.openid_mp;
    if (!openId) {
        console.info(`[UserRewardNotify] Skip: user ${params.userId} has no MP openid`);
        return { attempted: false, success: false, reason: 'no_openid_mp' };
    }

    const profile = profileRes.rows[0];
    const rawName = profile?.display_name?.trim() || '';
    const emailPrefix = (profile?.email || '').split('@')[0] || '';
    const accountName = toThing(rawName || emailPrefix || `U${params.userId.replace(/-/g, '').slice(0, 12)}`, 20);
    const balance = Number(creditRes.rows[0]?.balance || 0);
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
