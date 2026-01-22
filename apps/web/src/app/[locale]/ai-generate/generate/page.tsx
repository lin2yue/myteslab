import { createClient } from '@/utils/supabase/server';
import { redirect } from '@/i18n/routing';
import AIGeneratorMain from './AIGeneratorMain';

// Available models
const MODELS = [
    { slug: 'cybertruck', name: 'Cybertruck', modelUrl: 'https://cdn.tewan.club/models/wraps/cybertruck/model_v1.glb' },
    { slug: 'model-3', name: 'Model 3', modelUrl: 'https://cdn.tewan.club/models/wraps/model-3/model_v1.glb' },
    { slug: 'model-3-2024-plus', name: 'Model 3 2024+', modelUrl: 'https://cdn.tewan.club/models/wraps/model-3-2024-plus/model_v1.glb' },
    { slug: 'model-y-pre-2025', name: 'Model Y', modelUrl: 'https://cdn.tewan.club/models/wraps/model-y-pre-2025/model_v2.glb' },
    { slug: 'model-y-2025-plus', name: 'Model Y 2025+', modelUrl: 'https://cdn.tewan.club/models/wraps/model-y-2025-plus/model_v3.glb' },
]

export default async function GeneratePage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect({ href: '/login', locale });
    }

    // Fetch initial credits
    const { data: credits } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();

    return (
        <AIGeneratorMain
            initialCredits={credits?.balance || 0}
            models={MODELS}
            locale={locale}
        />
    );
}

