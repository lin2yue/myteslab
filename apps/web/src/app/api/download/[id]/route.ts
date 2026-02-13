import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDownloadUrl } from '@/lib/oss'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()

        // 基础安全校验：Referer
        const referer = request.headers.get('referer');
        if (referer && !referer.includes('myteslab.com') && !referer.includes('localhost') && !referer.includes('tewan.club')) {
            return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
        }

        // 1. 获取用户信息
        const { data: { user } } = await supabase.auth.getUser();

        // 强制登录保护
        if (!user) {
            return NextResponse.json({ error: 'Please login to download' }, { status: 401 });
        }

        // 2. 检查下载配额 (每日 20 次)
        const { count, error: countError } = await supabase
            .from('user_downloads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gt('downloaded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (countError) {
            console.error('[download] count check failed:', countError);
        } else if (count !== null && count >= 20) {
            return NextResponse.json({
                error: 'Daily download limit reached (20). please try again tomorrow.'
            }, { status: 429 });
        }

        // 3. 获取贴图信息
        const { data: wrap, error: wrapError } = await supabase
            .from('wraps')
            .select('*')
            .eq('id', id)
            .single()

        if (wrapError || !wrap) {
            return NextResponse.json({ error: 'Wrap not found' }, { status: 404 })
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

        // 5. 增加下载计数并记录下载历史
        // 增加总下载量 (使用 service role 绕过 RLS，避免匿名用户更新失败)
        try {
            const admin = createAdminClient();
            await admin.rpc('increment_download_count', {
                wrap_id: id
            });
        } catch (err) {
            console.error('[download] increment_download_count failed:', err);
        }

        // 记录到个人下载历史 (已经在上方验证过 user 存在)
        await supabase.from('user_downloads').insert({
            user_id: user.id,
            wrap_id: id
        });

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

