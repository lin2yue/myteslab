import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    try {
        const supabase = await createClient();

        // Fetch last 5 items (Newest)
        const { data, error } = await supabase
            .from('generated_wraps')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        return NextResponse.json({ success: true, count: data.length, data });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
