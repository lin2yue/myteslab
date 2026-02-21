import { NextResponse } from 'next/server'
import type { PoolClient } from 'pg'
import { getDownloadUrl } from '@/lib/oss'
import { getSessionUser } from '@/lib/auth/session'
import { db, dbQuery } from '@/lib/db'
import { ensureCreditRuleTables } from '@/lib/credits/rules'
import { notifyUserCreditRewardByWechat } from '@/lib/utils/user-reward-notify'

interface DownloadRewardEvent {
    userId: string;
    rewardCredits: number;
    milestoneDownloads: number;
    wrapName: string | null;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // 1. 获取贴图信息 - 从合并后的 wraps 表拉取
        const { rows } = await dbQuery(
            `SELECT id, texture_url, slug, user_id, is_active, is_public, deleted_at 
             FROM wraps WHERE id = $1 LIMIT 1`,
            [id]
        )
        const wrap = rows[0]
        if (!wrap || wrap.deleted_at) {
            return NextResponse.json({ error: '贴图不存在' }, { status: 404 })
        }

        // 2. 检查可见性与所有权
        const user = await getSessionUser();

        // 强制登录限制：必须登录才能下载
        if (!user) {
            return NextResponse.json({ error: '请登录后下载' }, { status: 401 });
        }

        // Referer 校验
        const referer = request.headers.get('referer');
        if (referer && !referer.includes('tewan.club') && !referer.includes('localhost')) {
            return NextResponse.json({ error: '非法请求' }, { status: 403 });
        }

        // 检查下载配额 (每日 20 次)
        const { rows: countRows } = await dbQuery<{ count: string }>(
            `SELECT COUNT(*)::int as count 
             FROM user_downloads 
             WHERE user_id = $1 
             AND downloaded_at > NOW() - INTERVAL '24 hours'`,
            [user.id]
        );

        if (Number(countRows[0]?.count || 0) >= 20) {
            return NextResponse.json({
                error: '已达到每日下载上限 (20次)，请明天再试'
            }, { status: 429 });
        }

        const isOwner = user.id === wrap.user_id;
        const isPubliclyAvailable = wrap.is_public && wrap.is_active;

        if (!isOwner && !isPubliclyAvailable) {
            return NextResponse.json({ error: '无权下载此私有贴图' }, { status: 403 });
        }

        const wrapData = {
            url: wrap.texture_url,
            slug: wrap.slug || `wrap-${id.substring(0, 8)}`
        };

        // Align with Tesla requirements: max 30 characters, alphanumeric, _, -, space.
        // ".png" is 4 characters, so prefix must be <= 26 characters.
        const sanitizeTeslaFilename = (input: string) => {
            return input
                .replace(/[^a-zA-Z0-9_\-\s]/g, '') // Only alphanumeric, _, -, space
                .substring(0, 26)                // Max 26 chars to allow .png suffix
                .replace(/[_\-\s]+$/, '')        // Remove trailing special chars
                .trim();
        };

        const fileNamePrefix = sanitizeTeslaFilename(wrapData.slug) || 'wrap';
        const downloadFilename = `${fileNamePrefix}.png`;

        if (!wrapData || !wrapData.url) {
            return NextResponse.json(
                { error: '贴图不存在' },
                { status: 404 }
            )
        }

        // 3. 记录下载历史 + 更新下载统计 + 命中规则时发放积分奖励
        let rewardEvent: DownloadRewardEvent | null = null;
        const client = await db().connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `INSERT INTO user_downloads (user_id, wrap_id, downloaded_at)
                 VALUES ($1, $2, NOW())`,
                [user.id, id]
            );

            const { rows: updatedWrapRows } = await client.query(
                `UPDATE wraps
                 SET download_count = COALESCE(download_count, 0) + 1,
                     user_download_count = (
                         SELECT COUNT(DISTINCT ud.user_id)::int
                         FROM user_downloads ud
                         WHERE ud.wrap_id = $1
                     )
                 WHERE id = $1
                 RETURNING id, user_id, is_public, user_download_count, name`,
                [id]
            );

            const updatedWrap = updatedWrapRows[0];
            if (updatedWrap) {
                rewardEvent = await applyDownloadMilestoneRewardIfNeeded(client, {
                    wrapId: updatedWrap.id,
                    ownerId: updatedWrap.user_id,
                    isPublic: Boolean(updatedWrap.is_public),
                    userDownloadCount: Number(updatedWrap.user_download_count || 0),
                    wrapName: updatedWrap.name || null,
                });
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('[download] update counts/rewards failed:', err);
        } finally {
            client.release();
        }

        if (rewardEvent) {
            void notifyUserCreditRewardByWechat({
                userId: rewardEvent.userId,
                rewardCredits: rewardEvent.rewardCredits,
                milestoneDownloads: rewardEvent.milestoneDownloads,
                wrapName: rewardEvent.wrapName,
            }).catch((err) => {
                console.error('[download] reward notify failed:', err);
            });
        }

        // 3. 优化下载逻辑：服务端压缩处理 (Server-Side Compression)
        // 目标：保持 1024x1024 分辨率，但文件体积必须 < 1MB
        // 方案：使用 sharp 进行 PNG 8-bit 色彩量化 (Palette Quantization)

        let finalBuffer: Buffer;

        if (wrapData.url.startsWith('data:')) {
            // 兼容 Base64 DataURL
            const matches = wrapData.url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return NextResponse.json({ error: '无效的贴图数据' }, { status: 500 });
            }
            const rawBuffer = Buffer.from(matches[2], 'base64');

            // 即使是 Base64，我们也统一过一遍 sharp 压缩，确保体积合规
            finalBuffer = await compressImage(rawBuffer);
        } else {
            // 获取带签名且已在 OSS 端调整过尺寸 (1024px) 的 URL
            const signedUrl = await getDownloadUrl(wrapData.url, downloadFilename);

            // 服务端拉取图片流
            const response = await fetch(signedUrl);
            if (!response.ok) {
                console.error(`Fetch failed: ${response.statusText}`);
                return NextResponse.json({ error: '获取贴图失败' }, { status: 502 });
            }
            const arrayBuffer = await response.arrayBuffer();

            // 执行服务端强力压缩
            finalBuffer = await compressImage(Buffer.from(arrayBuffer));
        }

        // 返回文件流
        return new NextResponse(new Uint8Array(finalBuffer), {
            headers: {
                'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadFilename)}"`,
                'Content-Type': 'image/png',
                'Content-Length': finalBuffer.length.toString(),
                'Cache-Control': 'no-cache'
            },
        });

    } catch (error) {
        console.error('下载失败:', error)
        return NextResponse.json(
            { error: '下载失败' },
            { status: 500 }
        )
    }
}

async function applyDownloadMilestoneRewardIfNeeded(
    client: PoolClient,
    params: {
        wrapId: string;
        ownerId: string;
        isPublic: boolean;
        userDownloadCount: number;
        wrapName: string | null;
    }
): Promise<DownloadRewardEvent | null> {
    if (!params.isPublic) return null;

    await ensureCreditRuleTables(client);
    await client.query(
        `INSERT INTO credit_reward_rules (
            id,
            registration_enabled,
            registration_credits,
            download_reward_enabled,
            download_threshold,
            download_reward_credits
        )
        VALUES (1, TRUE, 30, FALSE, 100, 10)
        ON CONFLICT (id) DO NOTHING`
    );

    const { rows: ruleRows } = await client.query(
        `SELECT download_reward_enabled, download_threshold, download_reward_credits
         FROM credit_reward_rules
         WHERE id = 1
         LIMIT 1`
    );
    const rule = ruleRows[0];
    if (!rule) return null;

    const rewardEnabled = Boolean(rule.download_reward_enabled);
    const threshold = Math.max(1, Number(rule.download_threshold || 1));
    const rewardCredits = Math.max(0, Number(rule.download_reward_credits || 0));

    if (!rewardEnabled || rewardCredits <= 0 || params.userDownloadCount < threshold) return null;

    const milestone = Math.floor(params.userDownloadCount / threshold) * threshold;
    if (milestone < threshold) return null;

    const { rows: grantRows } = await client.query(
        `INSERT INTO wrap_download_reward_grants (wrap_id, user_id, milestone_downloads, reward_credits)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (wrap_id, milestone_downloads) DO NOTHING
         RETURNING id`,
        [params.wrapId, params.ownerId, milestone, rewardCredits]
    );
    const grant = grantRows[0];
    if (!grant) return null;

    await client.query(
        `INSERT INTO user_credits (user_id, balance, total_earned, total_spent, updated_at)
         VALUES ($1, $2, $2, 0, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET
            balance = user_credits.balance + $2,
            total_earned = user_credits.total_earned + $2,
            updated_at = NOW()`,
        [params.ownerId, rewardCredits]
    );

    const { rows: ledgerRows } = await client.query(
        `INSERT INTO credit_ledger (user_id, amount, type, description, metadata, created_at)
         VALUES ($1, $2, 'system_reward', $3, $4::jsonb, NOW())
         RETURNING id`,
        [
            params.ownerId,
            rewardCredits,
            `Wrap download milestone reward (${milestone})`,
            JSON.stringify({
                source: 'wrap_download_milestone',
                wrap_id: params.wrapId,
                milestone_downloads: milestone,
                reward_credits: rewardCredits
            })
        ]
    );

    await client.query(
        `UPDATE wrap_download_reward_grants
         SET ledger_id = $2
         WHERE id = $1`,
        [grant.id, ledgerRows[0]?.id || null]
    );

    return {
        userId: params.ownerId,
        rewardCredits,
        milestoneDownloads: milestone,
        wrapName: params.wrapName,
    };
}

/**
 * 使用 Sharp 进行强力压缩
 * 策略：PNG-8 (Palette) + 1024px 限制
 */
async function compressImage(input: Buffer): Promise<Buffer> {
    const sharpModule = await import('sharp');
    return sharpModule.default(input)
        // 再次确保尺寸（虽然 OSS 可能处理过，但 Sharp 再跑一次更稳妥，且 fit: inside 保持比例）
        .resize(1024, 1024, {
            fit: 'inside',
            withoutEnlargement: true
        })
        .png({
            // 关键：开启调色板模式 (索引色)，极大减小体积
            palette: true,
            quality: 80, // 在 palette 模式下，quality 影响抖动程度
            compressionLevel: 9, // 最高压缩率
            adaptiveFiltering: true,
            force: true
        })
        .toBuffer();
}
