const { createClient } = require('@supabase/supabase-js')
const supabaseUrl = 'https://eysiovvlutxhgnnydedr.supabase.co'
const supabaseKey = 'sb_secret_LqnY_s7xeCVicfj4cl3n1A_9-GrgYiR'
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data, error } = await supabase
        .from('generated_wraps')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
    
    if (error) {
        console.error(error)
        return
    }
    
    console.log('Public wraps count:', data.length)
    data.forEach(w => {
        console.log(`ID: ${w.id}, Model: ${w.model_slug}, Texture starts with: ${w.texture_url?.substring(0, 50)}, Author: ${w.author_name}`)
    })
}
check()
