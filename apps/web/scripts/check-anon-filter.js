const { createClient } = require('@supabase/supabase-js')
const supabaseUrl = 'https://eysiovvlutxhgnnydedr.supabase.co'
const supabaseAnonKey = 'sb_publishable_Lf8-OhxRZcwcDhTqUOpbBA_JxoM7zt5'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
    console.log('Fetching with filter is_public = true...')
    const { data, error } = await supabase
        .from('generated_wraps')
        .select('*')
        .eq('is_public', true)
    
    if (error) console.error('Error:', error)
    else console.log('Anon saw public wraps:', data.length)
}
check()
