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

    // 参数合并逻辑：支持 URL 中已有的 x-oss-process
    const urlObj = new URL(targetUrl.startsWith('http') ? targetUrl : `https://temp.com${targetUrl}`);
    const existingProcess = urlObj.searchParams.get('x-oss-process');

    if (existingProcess) {
        // 如果已有处理流，直接在后面追加
        urlObj.searchParams.set('x-oss-process', `${existingProcess}/${processParts.join('/')}`);
    } else {
        urlObj.searchParams.set('x-oss-process', `image/${processParts.join('/')}`);
    }

    // 还原 URL (如果是相对路径需要去掉假前缀)
    const finalUrl = targetUrl.startsWith('http') ? urlObj.toString() : urlObj.toString().replace('https://temp.com', '');
    return finalUrl;
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
