import { createClient } from '@/utils/supabase/server';
import { redirect } from '@/i18n/routing';
import AIGeneratorMain from './AIGeneratorMain';

// Available models
const MODELS = [
    { slug: 'cybertruck', name: 'Cybertruck', modelUrl: '/models/Cybertruck/cybertruck.glb' },
    { slug: 'model-3', name: 'Model 3', modelUrl: '/models/model-3/model_3.glb' },
    { slug: 'model-3-2024-plus', name: 'Model 3 2024+', modelUrl: '/models/model-3-2024-plus/model_3_2024plus.glb' },
    { slug: 'model-y-pre-2025', name: 'Model Y', modelUrl: '/models/model-y-pre-2025/model_v2.glb' },
    { slug: 'model-y-2025-plus', name: 'Model Y 2025+', modelUrl: '/models/model-y-2025-plus/model_y_2025plus.glb' },
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

