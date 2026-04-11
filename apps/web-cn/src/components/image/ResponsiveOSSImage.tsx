'use client';

import Image, { ImageProps } from 'next/image';
import { aliyunLoader, ensureCdnUrl } from '@/lib/images';

/**
 * 响应式 OSS 图片组件
 * 专门解决 Next.js Server Components 中无法直接传递 loader 给 Image 组件的问题。
 *
 * 注意：next.config.ts 设置了 unoptimized: true，该模式下 Next.js 会绕过 loader
 * 直接使用原始 src，因此这里在传入 Image 之前先通过 ensureCdnUrl 统一改写 OSS 域名
 * 为 CDN 域名，确保 unoptimized 模式下图片也能正确加载。
 */
export default function ResponsiveOSSImage({ src, ...props }: ImageProps) {
    const normalizedSrc = typeof src === 'string' ? ensureCdnUrl(src) : src;
    return (
        <Image
            loader={aliyunLoader}
            src={normalizedSrc}
            {...props}
        />
    );
}
