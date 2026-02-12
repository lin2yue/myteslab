import { redirect } from 'next/navigation';
import { getModels } from '@/lib/api';
import AIGeneratorMain from './AIGeneratorMain';
import { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';

export async function generateMetadata(): Promise<Metadata> {

    const title = 'AI 特斯拉贴膜生成器 | 定制设计模板与工作室 | 特玩';

    const description = '使用 AI 创建定制特斯拉车身贴膜设计。免费模板、即时 3D 预览和专业贴膜设计工作室。为 Model 3、Model Y、Cybertruck 生成独特贴膜。立即下载您的定制特斯拉贴膜设计。';

    const keywords = '特斯拉贴膜模板, 特斯拉贴膜设计, 定制特斯拉贴膜, 特斯拉贴膜工作室, 特斯拉贴膜下载, 特斯拉贴膜颜色, AI 贴膜生成器';

    return {
        title,
        description,
        keywords,
        alternates: {
            canonical: '/ai-generate/generate',
        },
        openGraph: {
            title,
            description,
            url: 'https://tewan.club/ai-generate/generate',
            siteName: '特玩',
            images: [
                {
                    url: '/og-image.png',
                    width: 1200,
                    height: 630,
                    alt: '特玩 AI Tesla Wrap Generator',
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
    };
}


export default async function GeneratePage() {
    const locale = 'zh';
    const user = await getSessionUser();

    // Fetch initial credits if user exists
    let creditsBalance = 0;
    if (user) {
        const { rows } = await dbQuery<{ balance: number }>(
            'SELECT balance FROM user_credits WHERE user_id = $1 LIMIT 1',
            [user.id]
        );
        creditsBalance = rows[0]?.balance || 0;
    }

    // Use the cached getModels function
    const modelsData = await getModels();

    // Fallback or transform
    const models = modelsData.map((m: any) => ({
        slug: m.slug,
        name: m.name,
        name_en: m.name_en,
        modelUrl: m.model_3d_url || undefined,
        wheelUrl: m.wheel_url || undefined
    }));

    return (
        <AIGeneratorMain
            initialCredits={creditsBalance}
            models={models}
            locale={locale}
            isLoggedIn={!!user}
        />
    );
}
