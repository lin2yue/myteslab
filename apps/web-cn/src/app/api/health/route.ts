import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

const databaseUrl = process.env.DATABASE_URL

export async function GET() {
    const checks = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {} as Record<string, any>
    }

    // Check environment variables
    checks.checks.env = {
        status: databaseUrl ? 'ok' : 'error',
        hasDatabaseUrl: !!databaseUrl,
        cdnUrl: process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.tewan.club'
    }

    // Check database connection
    if (databaseUrl) {
        try {
            await dbQuery('SELECT 1');
            checks.checks.database = {
                status: 'ok',
                connected: true
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
            reason: 'Missing DATABASE_URL'
        }
    }

    // Models availability check will be re-enabled after data layer migration

    // Determine overall status
    const hasErrors = Object.values(checks.checks).some((check: any) => check.status === 'error')
    const hasWarnings = Object.values(checks.checks).some((check: any) => check.status === 'warning')

    checks.status = hasErrors ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy'

    return NextResponse.json(checks, {
        status: hasErrors ? 503 : 200
    })
}
