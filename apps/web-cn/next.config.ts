import type { NextConfig } from "next";
import bundleAnalyzer from '@next/bundle-analyzer'

const isAnalyze = process.env.ANALYZE === 'true'

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    // 确保这些环境变量在构建时被注入
    NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    NEXT_PUBLIC_BAIDU_ANALYTICS_ID: process.env.NEXT_PUBLIC_BAIDU_ANALYTICS_ID,
  },
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.tewan.club',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.tewan.club',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'tewan.club',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      // www -> non-www redirect
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.tewan.club' }],
        destination: 'https://tewan.club/:path*',
        permanent: true,
      },
      // /zh -> / redirect
      {
        source: '/zh',
        destination: '/',
        permanent: true,
      },
      // /zh/* -> /* redirect for SEO (301 permanent redirect)
      // use :path+ to avoid empty capture causing invalid Location header
      {
        source: '/zh/:path+',
        destination: '/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://hm.baidu.com https://zz.bdstatic.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' data: blob: https://cdn.tewan.club https://www.googletagmanager.com https://www.google-analytics.com https://www.tewan.club https://tewan.club;
      font-src 'self' https://fonts.gstatic.com;
      connect-src 'self' https://cdn.tewan.club https://www.google-analytics.com https://hm.baidu.com https://vitals.vercel-insights.com https://*.paddle.com;
      frame-ancestors 'self';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy-Report-Only', value: cspHeader },
          // 移动端优化响应头
          { key: 'Cache-Control', value: 'no-transform' }, // 百度禁止转码
          { key: 'MobileOptimized', value: 'width' },
          { key: 'HandheldFriendly', value: 'true' },
        ],
      },
      {
        source: '/models/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
        ],
      },
      {
        source: '/masks/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://tewan.club' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Vary', value: 'Origin' },
        ],
      },
    ];
  },
};

const withBundleAnalyzer = bundleAnalyzer({ enabled: isAnalyze })

export default withBundleAnalyzer(nextConfig)
