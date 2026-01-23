import { createClient } from '@/utils/supabase/server';
import { redirect } from '@/i18n/routing';
import { getModels } from '@/lib/api';
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

    // Use the cached getModels function
    const modelsData = await getModels();

    // Fallback or transform
    const models = modelsData.map((m: any) => ({
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

