/**
 * 阿里云 OSS 图片处理工具函数
 * 说明文档: https://help.aliyun.com/document_detail/44688.html
 */

export type OSSImageOptions = {
    width?: number;
    height?: number;
    format?: 'webp' | 'jpg' | 'png' | 'gif';
    quality?: number;
    resize?: 'fit' | 'fill' | 'mfit' | 'lfit' | 'pad';
};

export function getOptimizedImageUrl(url: string | undefined | null, options: OSSImageOptions = {}): string {
    if (!url) return '';

    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club';
    let targetUrl = url;

    // 强制资源走 CDN
    if (url.includes('aliyuncs.com')) {
        try {
            const urlObj = new URL(url);
            targetUrl = `${cdnUrl}${urlObj.pathname}${urlObj.search}`;
        } catch (e) {
            // ignore
        }
    }

    // 如果不是 CDN/OSS 链接且重写后也不是，直接返回
    if (!targetUrl.includes('cdn.tewan.club') && !targetUrl.includes('aliyuncs.com')) {
        return targetUrl;
    }

    const { width, height, format = 'webp', quality, resize = 'lfit' } = options;
    const processParts: string[] = [];

    // 缩放
    if (width || height) {
        let resizeStr = `image/resize,m_${resize}`;
        if (width) resizeStr += `,w_${width}`;
        if (height) resizeStr += `,h_${height}`;
        processParts.push(resizeStr);
    }

    // 格式转换 (强制 WebP 以减小体积)
    if (format) {
        processParts.push(`format,${format}`);
    }

    // 质量限制
    if (quality) {
        processParts.push(`quality,q_${quality}`);
    }

    if (processParts.length === 0) return targetUrl;

    const separator = targetUrl.includes('?') ? '&' : '?';
    const processQuery = `x-oss-process=${processParts.join('/')}`;

    return `${targetUrl}${separator}${processQuery}`;
}

/**
 * Next.js Image Loader for Alibaba Cloud OSS
 * 用于实现响应式图片加载 (srcset)
 */
export function aliyunLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
    // 调用现有的优化函数，强制使用 webp 格式
    return getOptimizedImageUrl(src, {
        width,
        quality: quality || 75,
        format: 'webp',
        resize: 'lfit'
    });
}
