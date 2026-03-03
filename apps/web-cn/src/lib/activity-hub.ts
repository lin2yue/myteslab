import type { PoolClient } from 'pg';
import { db } from '@/lib/db';
import {
    ensureCreditRewardCampaignTables,
    normalizeCampaignRow,
    type CreditRewardCampaign,
    type CreditRewardCampaignMilestone,
} from '@/lib/credits/campaigns';
import {
    ensureOperationCampaignTables,
    normalizeOperationCampaignRow,
    type OperationCampaign,
} from '@/lib/operations/campaigns';

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = '') {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || fallback;
}

function asStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}

function toNullableString(value: unknown) {
    const text = asString(value);
    return text || null;
}

type ActivityWindow = {
    startAt: string;
    endAt: string;
    source: 'credit_campaign' | 'operation_campaign';
};

type ActivitySelection = {
    activityId: string | null;
    operationCampaign: OperationCampaign | null;
    creditCampaign: CreditRewardCampaign | null;
    window: ActivityWindow | null;
};

// 运营账号不参与活动榜单；超级管理员统一通过 role 过滤。
const ACTIVITY_RANKING_EXCLUDED_USER_IDS = ['2d020ec5-39ca-4757-a5a0-949e9698dc2b'] as const;

export type ActivityEntrySummary = {
    visible: boolean;
    href: string;
    activityId: string | null;
    label: string;
    badge: string | null;
    title: string;
};

export type ActivityHero = {
    title: string;
    subtitle: string;
    description: string;
    bullets: string[];
    ctaText: string;
    bannerUrl: string | null;
    actionType: string;
    actionTarget: string | null;
};

export type UserLeaderboardItem = {
    rank: number;
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    totalDownloads: number;
    wrapCount: number;
};

export type WrapLeaderboardItem = {
    rank: number;
    wrapId: string;
    slug: string | null;
    name: string;
    previewUrl: string | null;
    creatorId: string | null;
    creatorName: string;
    creatorAvatarUrl: string | null;
    publishedAt: string;
    activityDownloads: number;
    milestoneReached: boolean;
    reachedMilestone: number | null;
    rewardCredits: number;
};

export type CurrentUserStanding = {
    rank: number;
    totalDownloads: number;
    wrapCount: number;
};

export type ActivityHubPageData = {
    activityId: string | null;
    hasActiveCampaign: boolean;
    hero: ActivityHero;
    window: ActivityWindow | null;
    operationCampaign: OperationCampaign | null;
    creditCampaign: CreditRewardCampaign | null;
    userLeaderboard: UserLeaderboardItem[];
    userParticipantCount: number;
    wrapLeaderboard: WrapLeaderboardItem[];
    wrapParticipantCount: number;
    currentUserStanding: CurrentUserStanding | null;
};

async function getActiveOperationCampaign(client: PoolClient): Promise<OperationCampaign | null> {
    await ensureOperationCampaignTables(client);
    const { rows } = await client.query(
        `SELECT *
         FROM operations_campaigns
         WHERE archived_at IS NULL
           AND status = 'active'
           AND start_at <= NOW()
           AND end_at > NOW()
         ORDER BY priority DESC, updated_at DESC
         LIMIT 1`
    );

    if (!rows[0]) return null;
    return normalizeOperationCampaignRow(rows[0] as Record<string, unknown>);
}

async function getActiveCreditCampaign(client: PoolClient): Promise<CreditRewardCampaign | null> {
    await ensureCreditRewardCampaignTables(client);
    const { rows } = await client.query(
        `SELECT *
         FROM credit_reward_campaigns
         WHERE status = 'active'
           AND start_at <= NOW()
           AND end_at > NOW()
         ORDER BY start_at ASC, updated_at DESC
         LIMIT 1`
    );

    if (!rows[0]) return null;
    return normalizeCampaignRow(rows[0] as Record<string, unknown>);
}

async function getCreditCampaignById(client: PoolClient, id: string): Promise<CreditRewardCampaign | null> {
    await ensureCreditRewardCampaignTables(client);
    const { rows } = await client.query(
        `SELECT *
         FROM credit_reward_campaigns
         WHERE id = $1
         LIMIT 1`,
        [id]
    );

    if (!rows[0]) return null;
    return normalizeCampaignRow(rows[0] as Record<string, unknown>);
}

async function getOperationCampaignById(client: PoolClient, id: string): Promise<OperationCampaign | null> {
    await ensureOperationCampaignTables(client);
    const { rows } = await client.query(
        `SELECT *
         FROM operations_campaigns
         WHERE id = $1
           AND archived_at IS NULL
         LIMIT 1`,
        [id]
    );

    if (!rows[0]) return null;
    return normalizeOperationCampaignRow(rows[0] as Record<string, unknown>);
}

async function getOperationCampaignForWindow(
    client: PoolClient,
    startAt: string,
    endAt: string
): Promise<OperationCampaign | null> {
    await ensureOperationCampaignTables(client);
    const { rows } = await client.query(
        `SELECT *
         FROM operations_campaigns
         WHERE archived_at IS NULL
           AND end_at > $1
           AND start_at < $2
         ORDER BY
            CASE WHEN status = 'active' THEN 0 ELSE 1 END,
            priority DESC,
            updated_at DESC
         LIMIT 1`,
        [startAt, endAt]
    );

    if (!rows[0]) return null;
    return normalizeOperationCampaignRow(rows[0] as Record<string, unknown>);
}

function buildHero(
    operationCampaign: OperationCampaign | null,
    creditCampaign: CreditRewardCampaign | null
): ActivityHero {
    const content = asRecord(operationCampaign?.content);
    const action = asRecord(operationCampaign?.action_config);

    const fallbackTitle = creditCampaign?.name || '活动中心';
    const defaultBullets = creditCampaign
        ? [
            '活动期内累计下载量冲榜，排名越高越容易拿到活动好礼。',
            '活动期内新发布作品可参与下载里程碑挑战，达标即可获得积分奖励。',
        ]
        : ['关注站内活动节奏，及时查看进行中的福利和冲榜内容。'];

    return {
        title: asString(content.title, fallbackTitle),
        subtitle: asString(content.subtitle, creditCampaign ? '活动进行中，榜单实时刷新' : '查看当前活动内容与实时榜单'),
        description: asString(
            content.description,
            creditCampaign
                ? '榜单统计口径以当前下载里程碑活动时间窗口为准，活动内容同步整合运营活动配置。'
                : '当前页面展示站内进行中的活动内容与实时数据。'
        ),
        bullets: asStringArray(content.bullets).length > 0 ? asStringArray(content.bullets) : defaultBullets,
        ctaText: asString(content.cta_text, '查看活动'),
        bannerUrl: toNullableString(content.image_url),
        actionType: asString(action.type, 'none'),
        actionTarget: toNullableString(action.target),
    };
}

function getActivityWindow(
    operationCampaign: OperationCampaign | null,
    creditCampaign: CreditRewardCampaign | null
): ActivityWindow | null {
    if (creditCampaign) {
        return {
            startAt: creditCampaign.start_at,
            endAt: creditCampaign.end_at,
            source: 'credit_campaign',
        };
    }

    if (operationCampaign) {
        return {
            startAt: operationCampaign.start_at,
            endAt: operationCampaign.end_at,
            source: 'operation_campaign',
        };
    }

    return null;
}

async function getCurrentCampaignContext(client: PoolClient): Promise<ActivitySelection> {
    const operationCampaign = await getActiveOperationCampaign(client);
    const creditCampaign = await getActiveCreditCampaign(client);
    const activityId = creditCampaign?.id || operationCampaign?.id || null;

    return {
        activityId,
        operationCampaign,
        creditCampaign,
        window: getActivityWindow(operationCampaign, creditCampaign),
    };
}

async function getCampaignContextByActivityId(client: PoolClient, activityId: string): Promise<ActivitySelection | null> {
    const creditCampaign = await getCreditCampaignById(client, activityId);
    if (creditCampaign) {
        const window = getActivityWindow(null, creditCampaign);
        const operationCampaign = window
            ? await getOperationCampaignForWindow(client, window.startAt, window.endAt)
            : null;

        return {
            activityId: creditCampaign.id,
            operationCampaign,
            creditCampaign,
            window: getActivityWindow(operationCampaign, creditCampaign),
        };
    }

    const operationCampaign = await getOperationCampaignById(client, activityId);
    if (operationCampaign) {
        return {
            activityId: operationCampaign.id,
            operationCampaign,
            creditCampaign: null,
            window: getActivityWindow(operationCampaign, null),
        };
    }

    return null;
}

async function getUserLeaderboard(
    client: PoolClient,
    startAt: string,
    endAt: string
): Promise<{ items: UserLeaderboardItem[]; totalParticipants: number }> {
    const { rows } = await client.query(
        `WITH user_scores AS (
            SELECT
                w.user_id,
                COUNT(DISTINCT (ud.wrap_id, ud.user_id))::int AS total_downloads,
                COUNT(DISTINCT w.id)::int AS wrap_count
            FROM user_downloads ud
            JOIN wraps w ON w.id = ud.wrap_id
            JOIN profiles creator ON creator.id = w.user_id
            WHERE ud.downloaded_at >= $1
              AND ud.downloaded_at < $2
              AND ud.user_id IS NOT NULL
              AND w.user_id IS NOT NULL
              AND w.is_public = TRUE
              AND w.deleted_at IS NULL
              AND COALESCE(w.first_published_at, w.created_at) >= $1
              AND COALESCE(w.first_published_at, w.created_at) < $2
              AND creator.role IS DISTINCT FROM 'super_admin'
              AND NOT (creator.id = ANY($3::uuid[]))
            GROUP BY w.user_id
        ),
        ranked AS (
            SELECT
                user_id,
                total_downloads,
                wrap_count,
                DENSE_RANK() OVER (ORDER BY total_downloads DESC, wrap_count DESC, user_id) AS rank,
                COUNT(*) OVER ()::int AS participant_count
            FROM user_scores
        )
        SELECT
            r.rank,
            r.user_id,
            r.total_downloads,
            r.wrap_count,
            r.participant_count,
            p.display_name,
            p.avatar_url
        FROM ranked r
        LEFT JOIN profiles p ON p.id = r.user_id
        ORDER BY r.rank ASC, r.user_id ASC
        LIMIT 10`,
        [startAt, endAt, ACTIVITY_RANKING_EXCLUDED_USER_IDS]
    );

    const items = rows.map((row) => ({
        rank: Number(row.rank || 0),
        userId: String(row.user_id || ''),
        displayName: asString(row.display_name, '匿名创作者'),
        avatarUrl: toNullableString(row.avatar_url),
        totalDownloads: Number(row.total_downloads || 0),
        wrapCount: Number(row.wrap_count || 0),
    }));

    return {
        items,
        totalParticipants: Number(rows[0]?.participant_count || 0),
    };
}

async function getCurrentUserStanding(
    client: PoolClient,
    startAt: string,
    endAt: string,
    userId: string
): Promise<CurrentUserStanding | null> {
    const { rows } = await client.query(
        `WITH user_scores AS (
            SELECT
                w.user_id,
                COUNT(DISTINCT (ud.wrap_id, ud.user_id))::int AS total_downloads,
                COUNT(DISTINCT w.id)::int AS wrap_count
            FROM user_downloads ud
            JOIN wraps w ON w.id = ud.wrap_id
            JOIN profiles creator ON creator.id = w.user_id
            WHERE ud.downloaded_at >= $1
              AND ud.downloaded_at < $2
              AND ud.user_id IS NOT NULL
              AND w.user_id IS NOT NULL
              AND w.is_public = TRUE
              AND w.deleted_at IS NULL
              AND COALESCE(w.first_published_at, w.created_at) >= $1
              AND COALESCE(w.first_published_at, w.created_at) < $2
              AND creator.role IS DISTINCT FROM 'super_admin'
              AND NOT (creator.id = ANY($3::uuid[]))
            GROUP BY w.user_id
        ),
        ranked AS (
            SELECT
                user_id,
                total_downloads,
                wrap_count,
                DENSE_RANK() OVER (ORDER BY total_downloads DESC, wrap_count DESC, user_id) AS rank
            FROM user_scores
        )
        SELECT rank, total_downloads, wrap_count
        FROM ranked
        WHERE user_id = $4
        LIMIT 1`,
        [startAt, endAt, ACTIVITY_RANKING_EXCLUDED_USER_IDS, userId]
    );

    if (!rows[0]) return null;

    return {
        rank: Number(rows[0].rank || 0),
        totalDownloads: Number(rows[0].total_downloads || 0),
        wrapCount: Number(rows[0].wrap_count || 0),
    };
}

async function getWrapLeaderboard(
    client: PoolClient,
    startAt: string,
    endAt: string,
    milestones: CreditRewardCampaignMilestone[]
): Promise<{ items: WrapLeaderboardItem[]; totalParticipants: number }> {
    const { rows } = await client.query(
        `WITH qualified_wraps AS (
            SELECT
                w.id,
                w.slug,
                w.name,
                w.preview_url,
                w.user_id,
                COALESCE(w.first_published_at, w.created_at) AS published_at
            FROM wraps w
            JOIN profiles creator ON creator.id = w.user_id
            WHERE w.user_id IS NOT NULL
              AND w.is_public = TRUE
              AND w.deleted_at IS NULL
              AND COALESCE(w.first_published_at, w.created_at) >= $1
              AND COALESCE(w.first_published_at, w.created_at) < $2
              AND creator.role IS DISTINCT FROM 'super_admin'
              AND NOT (creator.id = ANY($3::uuid[]))
        ),
        wrap_scores AS (
            SELECT
                qw.id AS wrap_id,
                COUNT(DISTINCT ud.user_id)::int AS activity_downloads
            FROM qualified_wraps qw
            LEFT JOIN user_downloads ud
              ON ud.wrap_id = qw.id
             AND ud.downloaded_at >= $1
             AND ud.downloaded_at < $2
            GROUP BY qw.id
        ),
        ranked AS (
            SELECT
                qw.id AS wrap_id,
                qw.slug,
                qw.name,
                qw.preview_url,
                qw.user_id,
                qw.published_at,
                ws.activity_downloads,
                DENSE_RANK() OVER (ORDER BY ws.activity_downloads DESC, qw.published_at ASC, qw.id) AS rank,
                COUNT(*) OVER ()::int AS participant_count
            FROM qualified_wraps qw
            JOIN wrap_scores ws ON ws.wrap_id = qw.id
        )
        SELECT
            r.rank,
            r.wrap_id,
            r.slug,
            r.name,
            r.preview_url,
            r.user_id,
            r.published_at,
            r.activity_downloads,
            r.participant_count,
            p.display_name,
            p.avatar_url
        FROM ranked r
        LEFT JOIN profiles p ON p.id = r.user_id
        ORDER BY r.rank ASC, r.published_at ASC, r.wrap_id ASC
        LIMIT 10`,
        [startAt, endAt, ACTIVITY_RANKING_EXCLUDED_USER_IDS]
    );

    const items = rows.map((row) => {
        const activityDownloads = Number(row.activity_downloads || 0);
        const reachedRule = [...milestones]
            .sort((a, b) => a.milestone_downloads - b.milestone_downloads)
            .filter((rule) => activityDownloads >= rule.milestone_downloads)
            .at(-1) || null;

        return {
            rank: Number(row.rank || 0),
            wrapId: String(row.wrap_id || ''),
            slug: toNullableString(row.slug),
            name: asString(row.name, '未命名作品'),
            previewUrl: toNullableString(row.preview_url),
            creatorId: toNullableString(row.user_id),
            creatorName: asString(row.display_name, '匿名创作者'),
            creatorAvatarUrl: toNullableString(row.avatar_url),
            publishedAt: String(row.published_at || ''),
            activityDownloads,
            milestoneReached: Boolean(reachedRule),
            reachedMilestone: reachedRule?.milestone_downloads ?? null,
            rewardCredits: reachedRule?.reward_credits ?? 0,
        } satisfies WrapLeaderboardItem;
    });

    return {
        items,
        totalParticipants: Number(rows[0]?.participant_count || 0),
    };
}

export async function getActivityEntrySummary(): Promise<ActivityEntrySummary> {
    const client = await db().connect();
    try {
        const { activityId, operationCampaign, creditCampaign } = await getCurrentCampaignContext(client);
        const hero = buildHero(operationCampaign, creditCampaign);

        if (!operationCampaign && !creditCampaign) {
            return {
                visible: false,
                href: '/activities',
                activityId: null,
                label: '活动',
                badge: null,
                title: hero.title,
            };
        }

        return {
            visible: true,
            href: activityId ? `/activities?activityId=${encodeURIComponent(activityId)}` : '/activities',
            activityId,
            label: '活动',
            badge: creditCampaign ? '赢积分' : '进行中',
            title: hero.title,
        };
    } finally {
        client.release();
    }
}

export async function getActivityHubPageData(currentUserId?: string | null): Promise<ActivityHubPageData> {
    return getActivityHubPageDataByActivityId(undefined, currentUserId);
}

export async function getActivityHubPageDataByActivityId(
    activityId?: string | null,
    currentUserId?: string | null
): Promise<ActivityHubPageData> {
    const client = await db().connect();
    try {
        const selected = activityId
            ? await getCampaignContextByActivityId(client, activityId)
            : await getCurrentCampaignContext(client);
        const { activityId: resolvedActivityId, operationCampaign, creditCampaign, window } = selected || {
            activityId: null,
            operationCampaign: null,
            creditCampaign: null,
            window: null,
        };
        const hero = buildHero(operationCampaign, creditCampaign);

        if (!window) {
            return {
                activityId: resolvedActivityId,
                hasActiveCampaign: false,
                hero,
                window: null,
                operationCampaign,
                creditCampaign,
                userLeaderboard: [],
                userParticipantCount: 0,
                wrapLeaderboard: [],
                wrapParticipantCount: 0,
                currentUserStanding: null,
            };
        }

        const userLeaderboard = await getUserLeaderboard(client, window.startAt, window.endAt);
        const wrapLeaderboard = await getWrapLeaderboard(client, window.startAt, window.endAt, creditCampaign?.milestones || []);
        const currentUserStanding = currentUserId
            ? await getCurrentUserStanding(client, window.startAt, window.endAt, currentUserId)
            : null;

        return {
            activityId: resolvedActivityId,
            hasActiveCampaign: true,
            hero,
            window,
            operationCampaign,
            creditCampaign,
            userLeaderboard: userLeaderboard.items,
            userParticipantCount: userLeaderboard.totalParticipants,
            wrapLeaderboard: wrapLeaderboard.items,
            wrapParticipantCount: wrapLeaderboard.totalParticipants,
            currentUserStanding,
        };
    } finally {
        client.release();
    }
}
