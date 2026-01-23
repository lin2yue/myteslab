import type { Metadata } from "next";
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
    ? 'Free Tesla Wrap Designs & 3D Visualization Studio | Download & Customize | MyTesLab'
    : 'MyTesLab - 特斯拉车身贴膜设计免费下载 & 3D 可视化预览'

  const description = locale === 'en'
    ? 'Download 100+ free high-quality Tesla wrap designs. Instant 3D preview for Cybertruck, Model 3, Model Y, and more. Create and download your custom Tesla look for free.'
    : '免费下载 100+ 高质量特斯拉车身贴图设计。实时 3D 预览 Cybertruck、Model 3、Model Y 等车型。免费创作并下载您的定制特斯拉外观。'

  return {
    title,
    description,
    metadataBase: new URL('https://myteslab.com'),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        zh: '/zh',
      },
    },
    openGraph: {
      title,
      description,
      url: `https://myteslab.com/${locale}`,
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
