import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        const errorMsg = `[ADMIN-CLIENT] EnvVars Missing! URL: ${supabaseUrl ? 'OK' : 'MISSING'}, ServiceKey: ${supabaseServiceKey ? 'OK' : 'MISSING'}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    return createClient(
        supabaseUrl!,
        supabaseServiceKey!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}
