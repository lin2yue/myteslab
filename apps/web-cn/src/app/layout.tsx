import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { BaiduAnalytics } from '@/components/BaiduAnalytics';
import { BaiduPush } from '@/components/BaiduPush';
import { AlertProvider } from '@/components/alert/AlertProvider';
import { CreditsProvider } from '@/components/credits/CreditsProvider';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
    display: 'swap',
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
    display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
    const title = '特斯拉贴膜设计 - 免费 AI 设计工具和 3D 预览 | 特玩'

    const description = '浏览 100+ 免费特斯拉贴膜设计，支持 Model 3、Model Y、Cybertruck、Model S 和 Model X。使用 AI 设计工具创建定制贴膜，下载前实时 3D 预览。免费 Tesla Toybox 贴膜。'

    return {
        title,
        description,
        metadataBase: new URL('https://tewan.club'),
        alternates: {
            canonical: `/`,
        },
        openGraph: {
            title,
            description,
            url: `https://tewan.club`,
            siteName: '特玩',
            images: [
                {
                    url: '/og-image.png',
                    width: 1200,
                    height: 630,
                    alt: '特玩 - Tesla Wrap Visualization Platform',
                },
            ],
            locale: 'zh_CN',
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: ['/og-image.png'],
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large',
                'max-snippet': -1,
            },
        },
        verification: {
            google: 'ePlud_UhwMRjIZzM4kHYXLL3TuhADQs1dMCeYguF00w',
        },
        other: {
            'baidu-site-verification': 'codeva-owLmaXQfzs',
        },
    }
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="zh" suppressHydrationWarning>
            <head>
                {/* DNS 预解析 - CDN 和分析服务 */}
                <link rel="dns-prefetch" href="https://cdn.tewan.club" />
                <link rel="dns-prefetch" href="https://hm.baidu.com" />
                <link rel="dns-prefetch" href="https://zz.bdstatic.com" />
                <link rel="preconnect" href="https://cdn.tewan.club" crossOrigin="anonymous" />

                {/* 移动端优化 */}
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
                <meta name="format-detection" content="telephone=no, email=no" />
                <meta name="applicable-device" content="pc,mobile" />

                {/* 百度禁止转码 - 重要! */}
                <meta httpEquiv="Cache-Control" content="no-transform" />
                <meta httpEquiv="Cache-Control" content="no-siteapp" />

                {/* 移动端适配声明 */}
                <meta name="mobile-agent" content="format=html5; url=https://tewan.club" />

                {/* iOS Safari */}
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

                {/* 主题色 */}
                <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
                <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
                <Script
                    id="theme-init"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `
              (function () {
                try {
                  var stored = localStorage.getItem('theme');
                  var mode = stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var effective = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
                  var root = document.documentElement;
                  root.classList.toggle('dark', effective === 'dark');
                  root.classList.toggle('light', effective === 'light');
                  root.dataset.themeMode = mode;
                  root.style.colorScheme = effective;
                } catch (e) {}
              })();
            `,
                    }}
                />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 flex flex-col`}
            >
                <GoogleAnalytics />
                <BaiduAnalytics />
                <BaiduPush />
                <AlertProvider>
                    <CreditsProvider>
                        <AnalyticsTracker />
                        <Navbar />
                        <main className="flex-1 overflow-x-hidden">
                            {children}
                        </main>
                        <Footer />
                    </CreditsProvider>
                </AlertProvider>
            </body>
        </html>
    );
}
