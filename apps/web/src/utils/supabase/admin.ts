import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
        throw new Error('[SUPABASE ADMIN] Missing service role env vars')
    }

    return createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false }
    })
}
