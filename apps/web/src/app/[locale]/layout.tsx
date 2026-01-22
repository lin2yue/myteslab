import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import Navbar from '@/components/layout/Navbar';
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
    ? 'MyTesLab - Visualize Your Tesla Wraps'
    : 'MyTesLab - 特斯拉车身贴膜免费下载'

  const description = locale === 'en'
    ? 'Visualize your next look: The ultimate studio for custom Tesla wrap designs. Preview wraps on Cybertruck, Model 3, Model Y, and more.'
    : '为您的特斯拉可视化下一个造型：终极定制车身贴图设计工作室。支持 Cybertruck、Model 3、Model Y 等车型预览。'

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
          <Navbar />
          <main className="flex-1 overflow-x-hidden">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
