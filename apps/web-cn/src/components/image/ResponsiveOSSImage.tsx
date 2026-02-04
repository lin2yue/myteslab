'use client';

import Image, { ImageProps } from 'next/image';
import { aliyunLoader } from '@/lib/images';

/**
 * 响应式 OSS 图片组件
 * 专门解决 Next.js Server Components 中无法直接传递 loader 给 Image 组件的问题
 */
export default function ResponsiveOSSImage(props: ImageProps) {
    // 强制赋予 aliyunLoader，并透传其他所有 Next.js Image 的 Props
    return (
        <Image
            loader={aliyunLoader}
            {...props}
        />
    );
}
