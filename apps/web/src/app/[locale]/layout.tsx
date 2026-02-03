import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { AlertProvider } from '@/components/alert/AlertProvider';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import "../globals.css";

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

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  const title = locale === 'en'
    ? 'Tesla Wrap Designs - Free AI Wrap Designer & 3D Preview | MyTesLab'
    : '特斯拉贴膜设计 - 免费 AI 设计工具和 3D 预览 | MyTesLab'

  const description = locale === 'en'
    ? 'Browse 100+ free Tesla wrap designs for Model 3, Model Y, Cybertruck, Model S & Model X. Create custom wraps with AI designer. Real-time 3D preview before download. Free Tesla Toybox wraps.'
    : '浏览 100+ 免费特斯拉贴膜设计，支持 Model 3、Model Y、Cybertruck、Model S 和 Model X。使用 AI 设计工具创建定制贴膜，下载前实时 3D 预览。免费 Tesla Toybox 贴膜。'

  return {
    title,
    description,
    metadataBase: new URL('https://www.myteslab.com'),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        zh: '/zh',
        'x-default': '/',
      },
    },
    openGraph: {
      title,
      description,
      url: `https://www.myteslab.com/${locale}`,
      siteName: 'MyTesLab',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: 'MyTesLab - Tesla Wrap Visualization Platform',
        },
      ],
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
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
  }
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://cdn.tewan.club" />
        <link rel="preconnect" href="https://cdn.tewan.club" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 flex flex-col`}
      >
        <GoogleAnalytics />
        <Analytics />
        <SpeedInsights />
        <NextIntlClientProvider messages={messages}>
          <AlertProvider>
            <Navbar />
            <main className="flex-1 overflow-x-hidden">
              {children}
            </main>
            <Footer />
          </AlertProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
