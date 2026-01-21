const { createClient } = require('@supabase/supabase-js')
const supabaseUrl = 'https://eysiovvlutxhgnnydedr.supabase.co'
const supabaseAnonKey = 'sb_publishable_Lf8-OhxRZcwcDhTqUOpbBA_JxoM7zt5'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
    const { data: generated, error: genError } = await supabase
        .from('generated_wraps')
        .select('*')
    
    if (genError) console.error('Gen Error:', genError)
    else console.log('Anon saw generated wraps:', generated.length)

    const { data: wraps, error: wrapsError } = await supabase
        .from('wraps')
        .select('*')
    
    if (wrapsError) console.error('Wraps Error:', wrapsError)
    else console.log('Anon saw official wraps:', wraps.length)
}
check()
