import https from 'https';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRawDimensions() {
    const { data, error } = await supabase
        .from('wraps')
        .select('*')
        .eq('model_slug', 'cybertruck')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        console.error('Error fetching wrap');
        return;
    }

    const rawUrl = data.texture_url.split('?')[0];
    console.log(`Checking raw image: ${rawUrl}`);

    https.get(rawUrl, (res) => {
        let chunks = [];
        res.on('data', (chunk) => {
            chunks.push(chunk);
            // IHDR chunk is near the beginning
            if (Buffer.concat(chunks).length >= 24) {
                const buffer = Buffer.concat(chunks);
                const width = buffer.readUInt32BE(16);
                const height = buffer.readUInt32BE(20);
                console.log(`Raw Dimensions: ${width}x${height}`);
                console.log(`Orientation: ${width > height ? 'Horizontal' : 'Vertical'}`);
                res.destroy(); // Stop receiving data
            }
        });
    }).on('error', (e) => {
        console.error('Error:', e.message);
    });
}

checkRawDimensions().catch(console.error);
