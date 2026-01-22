import { createClient } from '@/utils/supabase/server';
import { redirect } from '@/i18n/routing';
import AIGeneratorMain from './AIGeneratorMain';

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

    if (!user) {
        return redirect({ href: '/login', locale });
    }

    // Fetch initial credits
    const { data: credits } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();

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
            initialCredits={credits?.balance || 0}
            models={models}
            locale={locale}
        />
    );
}

