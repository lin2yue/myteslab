import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'

export const metadata = {
    title: 'FAQ - Tesla Wrap Designs | 特玩',
    description: 'Frequently asked questions about Tesla wrap designs, AI designer, 3D preview, and Toybox installation.',
}

export default async function FAQPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const t = await getTranslations('FAQ')

    const faqs = [
        {
            question: locale === 'en' ? 'How can I design a Tesla wrap with AI?' : '如何使用 AI 设计特斯拉贴膜？',
            answer: locale === 'en'
                ? 'Use our AI-powered design tool to create custom Tesla wrap designs. Simply describe what you want (e.g., "cyberpunk neon grid" or "carbon fiber with blue accents"), and our AI will generate a unique wrap design optimized for your Tesla model. The AI understands Tesla-specific requirements and creates files ready for Toybox installation.'
                : '使用我们的 AI 驱动设计工具创建定制特斯拉贴膜。只需描述您想要的效果（例如"赛博朋克霓虹网格"或"蓝色碳纤维"），我们的 AI 将为您的特斯拉车型生成独特的贴膜设计。AI 理解特斯拉的具体要求，并创建可直接用于 Toybox 安装的文件。'
        },
        {
            question: locale === 'en' ? 'What is 特玩 Tesla Wrap Gallery?' : '什么是 特玩 特斯拉贴膜库？',
            answer: locale === 'en'
                ? '特玩 is a free online platform where you can browse, create, and download custom wrap designs for Tesla vehicles including Model 3, Model Y, Cybertruck, Model S, and Model X. All designs feature real-time 3D preview and are free to download. Perfect for Tesla Toybox Paint Shop.'
                : '特玩 是一个免费在线平台，您可以浏览、创建和下载特斯拉车辆的定制贴膜设计，包括 Model 3、Model Y、Cybertruck、Model S 和 Model X。所有设计都具有实时 3D 预览功能，并且免费下载。完美适配 Tesla Toybox Paint Shop。'
        },
        {
            question: locale === 'en' ? 'How do I create a Tesla wrap design?' : '如何创建特斯拉贴膜设计？',
            answer: locale === 'en'
                ? 'You can create custom Tesla wrap designs using our free AI designer. Click "AI Design" in the navigation menu, choose your Tesla model, describe your desired design, and our AI will generate it for you. You can also browse our gallery of 100+ community-created designs and download them for free.'
                : '您可以使用我们的免费 AI 设计工具创建定制特斯拉贴膜。点击导航菜单中的"AI 设计"，选择您的特斯拉车型，描述您想要的设计，我们的 AI 将为您生成。您也可以浏览我们的 100+ 社区创建设计库并免费下载。'
        },
        {
            question: locale === 'en' ? 'Are Tesla wrap designs free to download?' : '特斯拉贴膜设计可以免费下载吗？',
            answer: locale === 'en'
                ? 'Yes, all Tesla wrap designs in our gallery are completely free to download and use. No sign-up required for browsing and downloading. You can use them on your Tesla\'s Toybox Paint Shop feature at no cost.'
                : '是的，我们库中的所有特斯拉贴膜设计都完全免费下载和使用。浏览和下载无需注册。您可以免费在特斯拉的 Toybox Paint Shop 功能中使用它们。'
        },
        {
            question: locale === 'en' ? 'Which Tesla models are supported?' : '支持哪些特斯拉车型？',
            answer: locale === 'en'
                ? 'We support all major Tesla models: Cybertruck, Model 3 (both Legacy and 2024+), Model Y (both Legacy and 2025+), Model S, and Model X. Each design is optimized for specific model dimensions and can be filtered by model in our gallery.'
                : '我们支持所有主要特斯拉车型：Cybertruck、Model 3（经典款和焕新版）、Model Y（经典款和 2025+）、Model S 和 Model X。每个设计都针对特定车型尺寸优化，可以在我们的库中按车型筛选。'
        },
        {
            question: locale === 'en' ? 'How do I use Tesla wraps on my car\'s screen (Toybox)?' : '如何在车机屏幕上使用特斯拉贴膜（Toybox）？',
            answer: locale === 'en'
                ? '1. Download your favorite wrap design from 特玩. 2. Format a USB drive as exFAT or FAT32. 3. Create a folder named "Wraps" (exact spelling) at the root of the USB drive. 4. Copy the downloaded PNG file to the Wraps folder. 5. Insert the USB drive into your Tesla. 6. Go to Toybox → Paint Shop → Wraps on your car\'s touchscreen. 7. Select your custom wrap to apply it.'
                : '1. 从 特玩 下载您喜欢的贴膜设计。2. 将 U 盘格式化为 exFAT 或 FAT32。3. 在 U 盘根目录创建名为"Wraps"的文件夹（拼写必须准确）。4. 将下载的 PNG 文件复制到 Wraps 文件夹。5. 将 U 盘插入特斯拉。6. 在车机触摸屏上进入 Toybox → Paint Shop → Wraps。7. 选择您的定制贴膜应用。'
        },
        {
            question: locale === 'en' ? 'What file format do I need for Tesla Toybox wraps?' : 'Tesla Toybox 贴膜需要什么文件格式？',
            answer: locale === 'en'
                ? 'Tesla Toybox requires PNG files with specific requirements: File size must be under 1MB, resolution between 512x512 and 1024x1024 pixels, and file name should use only alphanumeric characters, spaces, underscores, or dashes (max 30 characters). All 特玩 downloads are pre-optimized to meet these requirements.'
                : 'Tesla Toybox 需要符合特定要求的 PNG 文件：文件大小必须小于 1MB，分辨率在 512x512 到 1024x1024 像素之间，文件名只能使用字母数字、空格、下划线或破折号（最多 30 个字符）。所有 特玩 下载都已预先优化以满足这些要求。'
        },
        {
            question: locale === 'en' ? 'Can I upload my own Tesla wrap designs?' : '我可以上传自己的特斯拉贴膜设计吗？',
            answer: locale === 'en'
                ? 'Yes! You can create and share your own Tesla wrap designs with the community. Use our DIY mode to upload your custom images, position them on the 3D model, and download the optimized file. You can also share your creations in our gallery for others to enjoy.'
                : '可以！您可以创建并与社区分享您自己的特斯拉贴膜设计。使用我们的 DIY 模式上传您的自定义图像，在 3D 模型上定位它们，然后下载优化后的文件。您还可以在我们的库中分享您的创作供他人欣赏。'
        },
        {
            question: locale === 'en' ? 'How do I view a design in 3D?' : '如何在 3D 中查看设计？',
            answer: locale === 'en'
                ? 'Click on any wrap design in our gallery to open the 3D preview. You can rotate the car by dragging, zoom in/out by scrolling, and double-click to reset the view. The 3D preview shows exactly how the wrap will look on your Tesla from all angles before you download it.'
                : '点击我们库中的任何贴膜设计即可打开 3D 预览。您可以通过拖动旋转车辆，通过滚动放大/缩小，双击重置视图。3D 预览会在您下载之前准确显示贴膜在特斯拉上从各个角度的外观。'
        },
        {
            question: locale === 'en' ? 'What\'s the difference between AI-generated and community wraps?' : 'AI 生成和社区贴膜有什么区别？',
            answer: locale === 'en'
                ? 'AI-generated wraps are created by our advanced AI based on your text descriptions, offering unique and personalized designs. Community wraps are created by other Tesla owners and shared in our gallery. Both types are free to download, optimized for Tesla Toybox, and feature 3D preview.'
                : 'AI 生成的贴膜是由我们的先进 AI 根据您的文本描述创建的，提供独特和个性化的设计。社区贴膜是由其他特斯拉车主创建并在我们的库中分享的。两种类型都可以免费下载，针对 Tesla Toybox 优化，并具有 3D 预览功能。'
        }
    ]

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                        {locale === 'en' ? 'Frequently Asked Questions' : '常见问题'}
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-zinc-400">
                        {locale === 'en'
                            ? 'Everything you need to know about Tesla wrap designs, AI designer, and Toybox installation'
                            : '关于特斯拉贴膜设计、AI 设计工具和 Toybox 安装的所有信息'
                        }
                    </p>
                </div>

                {/* FAQ List */}
                <div className="space-y-6">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className="panel p-6"
                        >
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                                {faq.question}
                            </h3>
                            <p className="text-gray-600 dark:text-zinc-400 leading-relaxed">
                                {faq.answer}
                            </p>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="mt-12 text-center">
                    <p className="text-gray-600 dark:text-zinc-400 mb-4">
                        {locale === 'en' ? 'Ready to get started?' : '准备开始了吗？'}
                    </p>
                    <Link
                        href="/"
                        className="btn-primary inline-flex items-center gap-2 px-8"
                    >
                        {locale === 'en' ? 'Browse Tesla Wraps' : '浏览特斯拉贴膜'}
                    </Link>
                </div>

                {/* FAQ Schema */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'FAQPage',
                            mainEntity: faqs.map(faq => ({
                                '@type': 'Question',
                                name: faq.question,
                                acceptedAnswer: {
                                    '@type': 'Answer',
                                    text: faq.answer
                                }
                            }))
                        })
                    }}
                />
            </div>
        </div>
    )
}
