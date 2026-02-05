import { NextResponse } from 'next/server'
import { getDownloadUrl } from '@/lib/oss'
import { getSessionUser } from '@/lib/auth/session'
import { dbQuery } from '@/lib/db'

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

        const isOwner = user.id === wrap.user_id;
        const isPubliclyAvailable = wrap.is_public && wrap.is_active;

        if (!isOwner && !isPubliclyAvailable) {
            return NextResponse.json({ error: '无权下载此私有贴图' }, { status: 403 });
        }

        const wrapData = {
            url: wrap.texture_url,
            slug: wrap.slug || `wrap-${id.substring(0, 8)}`
        };
        const fileNamePrefix = wrapData.slug;
        const downloadFilename = `${fileNamePrefix}.png`;

        if (!wrapData || !wrapData.url) {
            return NextResponse.json(
                { error: '贴图不存在' },
                { status: 404 }
            )
        }

        // 3. 增加下载计数并记录下载历史
        try {
            await dbQuery(
                `UPDATE wraps SET download_count = COALESCE(download_count, 0) + 1 WHERE id = $1`,
                [id]
            );
        } catch (err) {
            console.error('[download] increment_download_count failed:', err);
        }

        // 如果用户已登录，记录到个人下载历史
        if (user) {
            await dbQuery(
                `INSERT INTO user_downloads (user_id, wrap_id, downloaded_at)
                 VALUES ($1, $2, NOW())`,
                [user.id, id]
            );
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
        return new NextResponse(finalBuffer as any, {
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

/**
 * 使用 Sharp 进行强力压缩
 * 策略：PNG-8 (Palette) + 1024px 限制
 */
async function compressImage(input: Buffer): Promise<Buffer> {
    const sharp = require('sharp');
    return sharp(input)
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
