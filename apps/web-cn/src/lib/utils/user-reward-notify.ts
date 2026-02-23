import { dbQuery } from '@/lib/db';
import { sendMPTemplateMessage } from '@/lib/wechat-mp';
import { sendMail } from '@/lib/mail/transporter';

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

interface AdminAdjustmentWechatNotifyParams {
    userId: string;
    deltaCredits: number;
}

export interface RewardWechatNotifyResult {
    attempted: boolean;
    success: boolean;
    channel?: 'wechat' | 'email';
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
    const rawName = recipient?.display_name?.trim() || '';
    const emailPrefix = (recipient?.email || '').split('@')[0] || '';
    const accountName = toThing(rawName || emailPrefix || `U${params.userId.replace(/-/g, '').slice(0, 12)}`, 20);
    const balance = Number(recipient?.balance || 0);
    const wrapText = toThing(params.wrapName?.trim() || '下载里程碑奖励作品');
    if (!openId) {
        console.info(`[UserRewardNotify] user ${params.userId} has no MP openid, fallback to email`);
        return sendCreditNotifyEmail({
            userId: params.userId,
            email: recipient?.email || null,
            accountName,
            category: '下载里程碑奖励',
            projectName: wrapText,
            credits: Math.max(0, Math.floor(params.rewardCredits)),
            balance
        });
    }

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
            channel: 'wechat',
            errcode: result.errcode,
            error: result.error
        };
    }

    return { attempted: true, success: true, channel: 'wechat' };
}

export async function notifyUserTopUpByWechat(params: TopUpWechatNotifyParams): Promise<RewardWechatNotifyResult> {
    const templateId = process.env.WECHAT_MP_CREDIT_REWARD_TEMPLATE_ID || DEFAULT_REWARD_TEMPLATE_ID;
    const recipient = await getWechatRecipientData(params.userId);
    const row = recipient[0];
    const openId = row?.openid_mp;

    const rawName = row?.display_name?.trim() || '';
    const emailPrefix = (row?.email || '').split('@')[0] || '';
    const accountName = toThing(rawName || emailPrefix || `U${params.userId.replace(/-/g, '').slice(0, 12)}`, 20);
    const balance = Number(row?.balance || 0);
    if (!openId) {
        console.info(`[UserTopUpNotify] user ${params.userId} has no MP openid, fallback to email`);
        return sendCreditNotifyEmail({
            userId: params.userId,
            email: row?.email || null,
            accountName,
            category: params.category || '积分充值',
            projectName: params.projectName || '积分充值',
            credits: Math.max(0, Math.floor(params.creditsAdded)),
            balance
        });
    }

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
            channel: 'wechat',
            errcode: result.errcode,
            error: result.error
        };
    }

    return { attempted: true, success: true, channel: 'wechat' };
}

export async function notifyUserAdminAdjustmentByWechat(
    params: AdminAdjustmentWechatNotifyParams
): Promise<RewardWechatNotifyResult> {
    const delta = Number(params.deltaCredits || 0);
    if (!Number.isFinite(delta) || delta === 0) {
        return { attempted: false, success: false, reason: 'zero_delta' };
    }

    const absDelta = Math.max(0, Math.floor(Math.abs(delta)));
    return notifyUserTopUpByWechat({
        userId: params.userId,
        creditsAdded: absDelta,
        category: delta > 0 ? '管理员赠送' : '管理员扣减',
        projectName: '后台积分调整',
    });
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

async function sendCreditNotifyEmail(params: {
    userId: string;
    email: string | null;
    accountName: string;
    category: string;
    projectName: string;
    credits: number;
    balance: number;
}): Promise<RewardWechatNotifyResult> {
    const recipientEmail = (params.email || '').trim();
    if (!recipientEmail) {
        return { attempted: false, success: false, reason: 'no_openid_mp_and_no_email' };
    }

    const smtpUser = (process.env.DM_SMTP_USER || '').trim();
    const smtpPass = (process.env.DM_SMTP_PASS || '').trim();
    if (!smtpUser || !smtpPass) {
        return { attempted: false, success: false, channel: 'email', reason: 'email_not_configured' };
    }

    const category = toThing(params.category, 20);
    const projectName = toThing(params.projectName, 20);
    const credits = String(Math.max(0, Math.floor(params.credits)));
    const balance = `${Number(params.balance || 0)}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tewan.club';

    const subject = `积分通知｜${category}`;
    const text = [
        `你好，${params.accountName}`,
        '',
        '你的积分账户有新的变动：',
        `通知类型：${category}`,
        `项目名称：${projectName}`,
        `变动积分：${credits}`,
        `当前余额：${balance}`,
        '',
        `查看账户：${appUrl}/profile`,
        '',
        '这是一封系统自动发送的通知邮件。'
    ].join('\n');

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 24px; border-radius: 10px;">
            <h2 style="margin: 0 0 16px; color: #111;">积分通知</h2>
            <p style="margin: 0 0 16px; color: #333;">你好，${escapeHtml(params.accountName)}，你的积分账户有新的变动。</p>
            <table style="width: 100%; border-collapse: collapse; margin: 12px 0 18px;">
                <tr>
                    <td style="padding: 8px 0; color: #666; width: 110px;">通知类型</td>
                    <td style="padding: 8px 0; color: #111; font-weight: 600;">${escapeHtml(category)}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #666;">项目名称</td>
                    <td style="padding: 8px 0; color: #111; font-weight: 600;">${escapeHtml(projectName)}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #666;">变动积分</td>
                    <td style="padding: 8px 0; color: #111; font-weight: 600;">${escapeHtml(credits)}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #666;">当前余额</td>
                    <td style="padding: 8px 0; color: #111; font-weight: 600;">${escapeHtml(balance)}</td>
                </tr>
            </table>
            <a href="${escapeHtml(`${appUrl}/profile`)}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px;">查看我的积分</a>
            <p style="margin: 18px 0 0; color: #888; font-size: 12px;">这是一封系统自动发送的通知邮件。</p>
        </div>
    `;

    const result = await sendMail({
        to: recipientEmail,
        subject,
        text,
        html
    });

    if (!result.success) {
        const message = result.error instanceof Error ? result.error.message : String(result.error || 'send mail failed');
        return { attempted: true, success: false, channel: 'email', reason: 'email_send_failed', error: message };
    }

    return { attempted: true, success: true, channel: 'email' };
}

function escapeHtml(input: string): string {
    return (input || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
