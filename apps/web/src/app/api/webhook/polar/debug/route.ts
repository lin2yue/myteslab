import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    console.log('--- RAW WEBHOOK PAYLOAD START ---');
    console.log(rawBody);
    console.log('--- RAW WEBHOOK PAYLOAD END ---');

    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Attempt to log this to a Supabase table if available for remote debugging
    const adminSupabase = createAdminClient();
    await adminSupabase.from('profiles').update({
        avatar_url: `DEBUG_WEBHOOK_${Date.now()}`
    }).eq('display_name', 'WEBHOOK_DEBUGGER'); // Just a hacky way to log if needed

    return NextResponse.json({ received: true });
}
