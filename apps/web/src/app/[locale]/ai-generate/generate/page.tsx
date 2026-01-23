import { createClient } from '@/utils/supabase/server';
import { redirect } from '@/i18n/routing';
import AIGeneratorMain from './AIGeneratorMain';
import { Metadata } from 'next';

export async function generateMetadata({
    params
}: {
    params: Promise<{ locale: string }>
}): Promise<Metadata> {
    const { locale } = await params;

    const title = locale === 'en'
        ? 'AI Tesla Wrap Generator | Custom Design Templates & Studio | MyTesLab'
        : 'AI 特斯拉贴膜生成器 | 定制设计模板与工作室 | MyTesLab';

    const description = locale === 'en'
        ? 'Create custom Tesla wrap designs with AI. Free templates, instant 3D preview, and professional wrap design studio. Generate unique wraps for Model 3, Model Y, Cybertruck. Download your custom Tesla wrap design now.'
        : '使用 AI 创建定制特斯拉车身贴膜设计。免费模板、即时 3D 预览和专业贴膜设计工作室。为 Model 3、Model Y、Cybertruck 生成独特贴膜。立即下载您的定制特斯拉贴膜设计。';

    const keywords = locale === 'en'
        ? 'tesla wrap template, tesla wrap design, tesla wrap custom, tesla wrap studio, tesla wraps download, tesla wrap colors, custom tesla wrap, ai wrap generator, tesla wrap near me, tesla model 3 wrap, tesla model y wrap, cybertruck wrap'
        : '特斯拉贴膜模板, 特斯拉贴膜设计, 定制特斯拉贴膜, 特斯拉贴膜工作室, 特斯拉贴膜下载, 特斯拉贴膜颜色, AI 贴膜生成器';

    return {
        title,
        description,
        keywords,
        alternates: {
            canonical: `/${locale}/ai-generate/generate`,
            languages: {
                en: '/en/ai-generate/generate',
                zh: '/zh/ai-generate/generate',
            },
        },
        openGraph: {
            title,
            description,
            url: `https://myteslab.com/${locale}/ai-generate/generate`,
            siteName: 'MyTesLab',
            images: [
                {
                    url: '/og-image.png',
                    width: 1200,
                    height: 630,
                    alt: 'MyTesLab AI Tesla Wrap Generator',
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
    };
}


export default async function GeneratePage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;
    const supabase = await createClient();

    const {
        data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    // Fetch initial credits if user exists
    let creditsBalance = 0;
    if (user) {
        const { data: credits } = await supabase
            .from('user_credits')
            .select('balance')
            .eq('user_id', user.id)
            .single();
        creditsBalance = credits?.balance || 0;
    }

    // Fetch available models from DB
    const { data: modelsData } = await supabase
        .from('wrap_models')
        .select('slug, name, model_3d_url')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    // Fallback or transform
    const models = (modelsData || []).map(m => ({
        slug: m.slug,
        name: m.name,
        modelUrl: m.model_3d_url || undefined
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

