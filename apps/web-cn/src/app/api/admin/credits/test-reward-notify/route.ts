import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { dbQuery } from '@/lib/db';
import { notifyUserCreditRewardByWechat } from '@/lib/utils/user-reward-notify';

export async function POST(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const displayName = String(body?.displayName || '').trim();
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

    const result = await notifyUserCreditRewardByWechat({
        userId: user.id,
        rewardCredits: 10,
        milestoneDownloads: 0,
        wrapName: '里程碑奖励通知测试'
    });

    return NextResponse.json({
        success: result.success,
        userId: user.id,
        displayName: user.display_name,
        notifyResult: result
    });
}
