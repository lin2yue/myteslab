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

    // 如果不是 CDN/OSS 链接，直接返回
    if (!url.includes('cdn.tewan.club') && !url.includes('aliyuncs.com')) {
        return url;
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

    if (processParts.length === 0) return url;

    const separator = url.includes('?') ? '&' : '?';
    const processQuery = `x-oss-process=${processParts.join('/')}`;

    return `${url}${separator}${processQuery}`;
}
