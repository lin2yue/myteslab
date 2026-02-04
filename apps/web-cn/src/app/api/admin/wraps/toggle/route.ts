import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function POST(request: Request) {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const wrapId = body?.wrapId as string | undefined;
    const isActive = body?.is_active as boolean | undefined;

    if (!wrapId || typeof isActive !== 'boolean') {
        return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const { rows } = await dbQuery(
        `UPDATE wraps
         SET is_active = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, is_active`,
        [wrapId, isActive]
    );

    if (!rows[0]) {
        return NextResponse.json({ success: false, error: 'Wrap not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, wrap: rows[0] });
}

