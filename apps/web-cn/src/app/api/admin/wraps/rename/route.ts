import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/require-admin'

export async function POST(request: Request) {
    const admin = await requireAdmin()
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const wrapId = typeof body?.wrapId === 'string' ? body.wrapId.trim() : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : ''

    if (!wrapId || !name) {
        return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 })
    }

    if (name.length > 200) {
        return NextResponse.json({ success: false, error: 'Name is too long (max 200 chars)' }, { status: 400 })
    }

    const { rows } = await dbQuery(
        `UPDATE wraps
         SET name = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, updated_at`,
        [wrapId, name]
    )

    if (!rows[0]) {
        return NextResponse.json({ success: false, error: 'Wrap not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, wrap: rows[0] })
}

