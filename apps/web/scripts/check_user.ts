
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from apps/web/.env.local (standard for Next.js secrets)
const envLocalPath = path.resolve(__dirname, '../.env.local');
console.log('Loading env from:', envLocalPath);
dotenv.config({ path: envLocalPath });

// Also try .env just in case
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('Env Check:');
console.log('- URL:', supabaseUrl ? 'Found' : 'Missing');
console.log('- Key:', supabaseServiceRoleKey ? 'Found' : 'Missing');

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing env vars! Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkUser(email: string) {
    console.log(`Checking user: ${email}`);
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    const user = users.find(u => u.email === email);

    if (user) {
        console.log('User FOUND:');
        console.log(`- ID: ${user.id}`);
        console.log(`- Email: ${user.email}`);
        console.log(`- Confirmed At: ${user.email_confirmed_at}`);
        console.log(`- Last Sign In: ${user.last_sign_in_at}`);
        console.log(`- User Metadata:`, user.user_metadata);
    } else {
        console.log('User NOT FOUND in auth.users');
    }
}

checkUser('237645143@qq.com');
