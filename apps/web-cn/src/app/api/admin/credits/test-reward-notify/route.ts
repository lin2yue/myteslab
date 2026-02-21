import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { dbQuery } from '@/lib/db';
import { getPricingTierDisplayName } from '@/lib/constants/credits';
import { notifyUserCreditRewardByWechat, notifyUserTopUpByWechat } from '@/lib/utils/user-reward-notify';

export async function POST(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const displayName = String(body?.displayName || '').trim();
    const mode = String(body?.mode || 'milestone').trim();
    if (!displayName) {
        return NextResponse.json({ success: false, error: 'displayName is required' }, { status: 400 });
    }

    const { rows } = await dbQuery<{ id: string; display_name: string | null }>(
        `SELECT id, display_name
         FROM profiles
         WHERE display_name = $1
         LIMIT 1`,
        [displayName]
    );
    const user = rows[0];
    if (!user) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const result = mode === 'topup'
        ? await notifyUserTopUpByWechat({
            userId: user.id,
            creditsAdded: 200,
            category: '支付宝充值',
            projectName: getPricingTierDisplayName('explorer'),
        })
        : await notifyUserCreditRewardByWechat({
            userId: user.id,
            rewardCredits: 10,
            milestoneDownloads: 0,
            wrapName: '里程碑奖励通知测试'
        });

    return NextResponse.json({
        success: result.success,
        mode,
        userId: user.id,
        displayName: user.display_name,
        notifyResult: result
    });
}
