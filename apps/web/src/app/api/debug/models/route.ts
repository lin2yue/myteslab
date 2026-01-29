import { NextResponse } from 'next/server'
import { getModels } from '@/lib/api'
import { DEFAULT_MODELS } from '@/config/models'

export async function GET() {
    try {
        const models = await getModels()

        return NextResponse.json({
            success: true,
            source: models.length > 0 ? 'database' : 'fallback',
            count: models.length,
            models,
            fallbackAvailable: DEFAULT_MODELS.length,
            env: {
                hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                cdnUrl: process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'
            },
            cache: {
                note: 'Models are cached for 1 hour using Next.js unstable_cache'
            }
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            fallbackAvailable: DEFAULT_MODELS.length
        }, { status: 500 })
    }
}
