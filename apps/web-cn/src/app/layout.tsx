import type { Metadata } from "next";
import { Suspense } from 'react';
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
    const title = '特玩涂装 | 特斯拉喷漆车间贴膜免费下载 - AI 生成 + 3D 预览'

    const description = '特玩涂装 — 特斯拉喷漆车间素材、改色贴膜免费下载平台，海量涂装方案持续更新。覆盖 Model 3、Model Y、Cybertruck、Model S、Model X，支持 AI 一键生成改色方案、3D 实车预览，免费下载高清贴膜文件。'

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
            keywords: '特玩涂装,特斯拉涂装,特斯拉改色贴膜,特斯拉贴膜免费下载,特斯拉改色膜免费下载,特斯拉Model Y改色膜,特斯拉Model 3改色膜,特斯拉Cybertruck贴膜,特斯拉喷漆车间素材,特斯拉喷漆车间免费皮肤,Tesla wrap download,特斯拉AI改色,特斯拉3D预览贴膜,特斯拉车衣设计',
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
                <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              (function () {
                function bootCapture() {
                  try {
                    var hash = window.location.hash ? window.location.hash.slice(1) : '';
                    if (!hash) return;
                    var params = new URLSearchParams(hash);
                    var captureId = params.get('figmacapture');
                    var endpoint = params.get('figmaendpoint');
                    if (!captureId || !endpoint) return;

                    var selector = params.get('figmaselector') || 'main';
                    var delay = Number(params.get('figmadelay') || '1500');
                    var started = false;

                    function tryCapture() {
                      if (started) return;
                      if (!window.figma || typeof window.figma.captureForDesign !== 'function') {
                        window.setTimeout(tryCapture, 250);
                        return;
                      }

                      started = true;
                      window.figma.captureForDesign({
                        captureId: captureId,
                        endpoint: endpoint,
                        selector: selector,
                      }).catch(function (err) {
                        console.error('[figma-capture] capture failed', err);
                        started = false;
                        window.setTimeout(tryCapture, 1000);
                      });
                    }

                    window.setTimeout(tryCapture, delay);
                  } catch (err) {
                    console.error('[figma-capture] boot failed', err);
                  }
                }

                if (document.readyState === 'complete') {
                  bootCapture();
                } else {
                  window.addEventListener('load', bootCapture, { once: true });
                }
              })();
            `,
                    }}
                />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 flex flex-col`}
            >
                <GoogleAnalytics />
                <Suspense fallback={null}>
                    <BaiduAnalytics />
                </Suspense>
                <BaiduPush />
                <AlertProvider>
                    <CreditsProvider>
                        <Suspense fallback={null}>
                            <AnalyticsTracker />
                        </Suspense>
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
