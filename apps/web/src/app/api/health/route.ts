import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function GET() {
    const checks = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {} as Record<string, any>
    }

    // Check environment variables
    checks.checks.env = {
        status: supabaseUrl && supabaseAnonKey ? 'ok' : 'error',
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseAnonKey,
        cdnUrl: process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'
    }

    // Check database connection
    if (supabaseUrl && supabaseAnonKey) {
        try {
            const supabase = createClient(supabaseUrl, supabaseAnonKey)
            const { data, error } = await supabase
                .from('wrap_models')
                .select('count')
                .limit(1)

            checks.checks.database = {
                status: error ? 'error' : 'ok',
                error: error?.message,
                connected: !error
            }
        } catch (error) {
            checks.checks.database = {
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
                connected: false
            }
        }
    } else {
        checks.checks.database = {
            status: 'skipped',
            reason: 'Missing environment variables'
        }
    }

    // Check models availability
    try {
        const { getModels } = await import('@/lib/api')
        const models = await getModels()
        checks.checks.models = {
            status: models.length > 0 ? 'ok' : 'warning',
            count: models.length,
            message: models.length === 0 ? 'No models found' : undefined
        }
    } catch (error) {
        checks.checks.models = {
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
        }
    }

    // Determine overall status
    const hasErrors = Object.values(checks.checks).some((check: any) => check.status === 'error')
    const hasWarnings = Object.values(checks.checks).some((check: any) => check.status === 'warning')

    checks.status = hasErrors ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy'

    return NextResponse.json(checks, {
        status: hasErrors ? 503 : 200
    })
}
