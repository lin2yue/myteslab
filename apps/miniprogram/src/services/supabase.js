import { createClient } from 'supabase-wechat-stable-v2'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eysiovvlutxhgnnydedr.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Lf8-OhxRZcwcDhTqUOpbBA_JxoM7zt5';

const client = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Debug logging to confirm successful init
if (client) {
    console.log('✅ Supabase Client (WeChat Stable) Initialized');
} else {
    console.error('❌ Supabase Client Init Failed: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = client;
