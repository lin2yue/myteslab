
import fs from 'fs';
import path from 'path';

// Manual env parsing
const envPath = path.resolve(process.cwd(), 'apps/web/.env.local');
if (!fs.existsSync(envPath)) {
    console.error('.env.local not found');
    process.exit(1);
}
const envContent = fs.readFileSync(envPath, 'utf-8');
const envConfig: Record<string, string> = {};

envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        envConfig[key] = value;
    }
});

const supabaseUrl = envConfig['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envConfig['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

async function checkCredits() {
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
    };

    try {
        // Find users
        const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,display_name,email_confirmed_at`, { headers });
        const profiles = await profileRes.json();

        console.log('Profiles found:', profiles.length);

        // Find credits
        const creditsRes = await fetch(`${supabaseUrl}/rest/v1/user_credits?select=user_id,balance`, { headers });
        const credits = await creditsRes.json();

        console.log('Credits info count:', credits.length);

        // Match them (simplified)
        const summary = credits.map((c: any) => {
            const p = profiles.find((prof: any) => prof.id === c.user_id);
            return {
                id: c.user_id,
                name: p?.display_name || 'Unknown',
                balance: c.balance
            };
        });

        console.log('User Credits Summary:');
        console.log(JSON.stringify(summary, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

checkCredits();
